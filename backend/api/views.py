from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.db.models import Q, Count, Avg
from django.db import models
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.utils import timezone
from datetime import timedelta
import random

from users.models import CV, Position
from tests.models import Test, Question, AnswerOption, TestResult
from .serializers import (
    TestSerializer, TestListSerializer, QuestionSerializer,
    UserSerializer, UserCreateSerializer, CVSerializer,
    TestResultSerializer, TestResultCreateSerializer, PositionSerializer
)

User = get_user_model()


class PositionViewSet(viewsets.ReadOnlyModelViewSet):
    """Position viewset - faqat ochiq positionlarni qaytaradi"""
    queryset = Position.objects.filter(is_open=True)
    serializer_class = PositionSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_open']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']


class TestViewSet(viewsets.ModelViewSet):
    queryset = Test.objects.filter(is_active=True).prefetch_related('questions__options', 'positions')
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'positions']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'title']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return TestListSerializer
        return TestSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by position if provided
        position_id = self.request.query_params.get('position_id')
        if position_id:
            queryset = queryset.filter(positions__id=position_id, positions__is_open=True)
        
        # Filter by test_mode if provided
        test_mode = self.request.query_params.get('test_mode')
        if test_mode:
            queryset = queryset.filter(
                models.Q(test_mode=test_mode) | models.Q(test_mode='both')
            )
        
        if self.action == 'retrieve':
            return queryset.prefetch_related('questions__options', 'positions')
        return queryset.prefetch_related('positions')
    
    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        """Get test questions (random if configured)"""
        test = self.get_object()
        is_trial = request.query_params.get('trial', 'false').lower() == 'true'
        telegram_id = request.query_params.get('telegram_id')
        
        # Check if user is blocked
        if telegram_id:
            try:
                user = User.objects.get(telegram_id=telegram_id)
                if user.is_blocked:
                    return Response(
                        {'error': 'User is blocked', 'reason': user.blocked_reason},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except User.DoesNotExist:
                pass
        
        questions = test.questions.all().prefetch_related('options').order_by('order', 'id')
        
        # Trial test
        if is_trial:
            questions = list(questions)
            trial_count = test.trial_questions_count
            if len(questions) > trial_count:
                questions = random.sample(questions, trial_count)
        # Random questions for regular test
        elif test.random_questions_count > 0:
            questions = list(questions)
            if len(questions) > test.random_questions_count:
                questions = random.sample(questions, test.random_questions_count)
        
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def start_test(self, request, pk=None):
        """Start test session"""
        test = self.get_object()
        telegram_id = request.data.get('telegram_id')
        is_trial = request.data.get('trial', False)
        
        if telegram_id:
            try:
                user = User.objects.get(telegram_id=telegram_id)
                if user.is_blocked:
                    return Response(
                        {'error': 'User is blocked', 'reason': user.blocked_reason},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # Check trial test
                if is_trial:
                    trial_tests = user.trial_tests_taken or []
                    if test.id in trial_tests:
                        return Response(
                            {'error': 'Trial test already taken for this test'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                
                # Generate test session token
                import uuid
                session_token = str(uuid.uuid4())
                
                return Response({
                    'session_token': session_token,
                    'test_id': test.id,
                    'time_limit': test.time_limit,
                    'is_trial': is_trial
                })
            except User.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        return Response(
            {'error': 'telegram_id required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['post'])
    def block_user(self, request, pk=None):
        """Block user for cheating"""
        test = self.get_object()
        telegram_id = request.data.get('telegram_id')
        reason = request.data.get('reason', 'Test tark etildi (cheating)')
        
        if telegram_id:
            try:
                user = User.objects.get(telegram_id=telegram_id)
                user.is_blocked = True
                user.blocked_reason = reason
                user.blocked_at = timezone.now()
                user.save()
                
                return Response({
                    'message': 'User blocked successfully',
                    'user_id': user.id
                })
            except User.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        return Response(
            {'error': 'telegram_id required'},
            status=status.HTTP_400_BAD_REQUEST
        )


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all().prefetch_related('options')
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['test']
    search_fields = ['text']


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['position']
    search_fields = ['username', 'first_name', 'last_name', 'email', 'phone']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    @action(detail=False, methods=['post'])
    def telegram_auth(self, request):
        """Authenticate user by Telegram ID"""
        telegram_id = request.data.get('telegram_id')
        if not telegram_id:
            return Response({'error': 'telegram_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(telegram_id=telegram_id)
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': UserSerializer(user).data
            })
        except User.DoesNotExist:
            # Create user if not exists
            user = User.objects.create_user(
                username=f'user_{telegram_id}',
                telegram_id=telegram_id,
                first_name=request.data.get('first_name', ''),
                last_name=request.data.get('last_name', '')
            )
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': UserSerializer(user).data
            }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def create_telegram_user(self, request):
        """Create user from Telegram data"""
        telegram_id = request.data.get('telegram_id')
        if telegram_id:
            try:
                user = User.objects.get(telegram_id=telegram_id)
                # Update user data
                for key in ['first_name', 'last_name', 'email', 'phone']:
                    if key in request.data:
                        value = request.data[key]
                        # first_name bo'sh bo'lmasligi kerak
                        if key == 'first_name' and not value:
                            value = user.first_name or 'User'
                        setattr(user, key, value)
                
                # first_name bo'sh bo'lsa, default qo'yish
                if not user.first_name:
                    user.first_name = request.data.get('first_name', 'User') or 'User'
                
                # Handle position (can be position_id)
                if 'position_id' in request.data:
                    position_id = request.data.get('position_id')
                    if position_id:
                        try:
                            position = Position.objects.get(id=position_id, is_open=True)
                            user.position = position
                        except Position.DoesNotExist:
                            pass
                
                user.save()
                refresh = RefreshToken.for_user(user)
                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'user': UserSerializer(user).data
                })
            except User.DoesNotExist:
                pass
        
        # Create new user
        username = request.data.get('username') or f'user_{telegram_id}'
        password = User.objects.make_random_password()
        
        user_data = {
            'username': username,
            'telegram_id': telegram_id,
            'first_name': request.data.get('first_name', ''),
            'last_name': request.data.get('last_name', ''),
            'email': request.data.get('email', ''),
            'phone': request.data.get('phone', ''),
            'password': password
        }
        
        # Handle position
        if 'position_id' in request.data:
            position_id = request.data.get('position_id')
            if position_id:
                try:
                    position = Position.objects.get(id=position_id, is_open=True)
                    user_data['position_id'] = position.id
                except Position.DoesNotExist:
                    pass
        
        serializer = UserCreateSerializer(data=user_data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': UserSerializer(user).data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CVViewSet(viewsets.ModelViewSet):
    serializer_class = CVSerializer
    permission_classes = [AllowAny]  # Bot uchun ochiq qildik
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['user']
    ordering_fields = ['uploaded_at']
    ordering = ['-uploaded_at']

    def get_queryset(self):
        # Staff uchun barcha CV'lar
        if self.request.user.is_authenticated and self.request.user.is_staff:
            return CV.objects.all()
        
        # Telegram ID bo'yicha filter (bot uchun)
        telegram_id = self.request.query_params.get('user__telegram_id')
        if telegram_id:
            return CV.objects.filter(user__telegram_id=telegram_id)
        
        # Authenticated user uchun faqat o'z CV'lari
        if self.request.user.is_authenticated:
            return CV.objects.filter(user=self.request.user)
        
        return CV.objects.none()

    def perform_create(self, serializer):
        # Bot uchun telegram_id orqali user topish
        telegram_id = self.request.data.get('telegram_id')
        if telegram_id:
            try:
                user = User.objects.get(telegram_id=telegram_id)
                serializer.save(user=user)
            except User.DoesNotExist:
                from rest_framework import serializers as drf_serializers
                raise drf_serializers.ValidationError("User not found")
        else:
            if not self.request.user.is_authenticated:
                from rest_framework import serializers as drf_serializers
                raise drf_serializers.ValidationError("Authentication required")
            serializer.save(user=self.request.user)
    
    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        
        # CV yuklanganidan keyin xabar
        if response.status_code == status.HTTP_201_CREATED:
            response.data['message'] = (
                "✅ CV muvaffaqiyatli yuklandi!\n\n"
                "Biz sizga tez orada aloqaga chiqamiz va siz bilan birinchi Zoom interview uchun maslahatlarimizni beramiz.\n\n"
                "Rahmat!"
            )
        
        return response


class TestResultViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # Bot uchun ochiq qildik, filter orqali cheklaymiz
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['test', 'user']
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'test__title']
    ordering_fields = ['completed_at', 'score']
    ordering = ['-completed_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return TestResultCreateSerializer
        return TestResultSerializer

    def get_queryset(self):
        # Staff uchun barcha natijalar
        if self.request.user.is_authenticated and self.request.user.is_staff:
            return TestResult.objects.all().select_related('user', 'test')
        
        # Telegram ID bo'yicha filter (bot uchun)
        telegram_id = self.request.query_params.get('user__telegram_id')
        if telegram_id:
            return TestResult.objects.filter(user__telegram_id=telegram_id).select_related('user', 'test')
        
        # Authenticated user uchun faqat o'z natijalari
        if self.request.user.is_authenticated:
            return TestResult.objects.filter(user=self.request.user).select_related('user', 'test')
        
        # Unauthenticated - bo'sh queryset
        return TestResult.objects.none()

    def create(self, request, *args, **kwargs):
        # Bot uchun telegram_id qo'shish (request.data dan olish)
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        
        response_data = TestResultSerializer(result).data
        
        # CV upload request (minimal ball o'tganda)
        if result.is_passed:
            response_data['requires_cv'] = True
            response_data['cv_upload_message'] = (
                "Tabriklaymiz! Siz testdan o'tdingiz. "
                "CV yuklash uchun tayyor bo'ling."
            )
        
        return Response(response_data, status=status.HTTP_201_CREATED)


class StatisticsView(APIView):
    permission_classes = [AllowAny]  # Frontend uchun ochiq qildik

    def get(self, request):
        # Development uchun authentication talab qilmaymiz
        # Production'da IsAuthenticated va is_staff tekshiruvini qo'shing

        # Total tests taken
        total_tests = TestResult.objects.count()

        # Average score
        avg_score = TestResult.objects.aggregate(avg=Avg('score'))['avg'] or 0

        # Total users
        total_users = User.objects.count()

        # Tests by user position (user lavozimi bo'yicha)
        tests_by_position = TestResult.objects.values('user__position__name').annotate(
            count=Count('id')
        ).order_by('-count')[:10]

        # Best results
        best_results = TestResult.objects.select_related('user', 'test').order_by('-score')[:10]
        best_results_data = TestResultSerializer(best_results, many=True).data

        # Recent results
        recent_results = TestResult.objects.select_related('user', 'test').order_by('-completed_at')[:10]
        recent_results_data = TestResultSerializer(recent_results, many=True).data

        # Tests taken today
        today = timezone.now().date()
        tests_today = TestResult.objects.filter(completed_at__date=today).count()

        # Tests taken this week
        week_ago = timezone.now() - timedelta(days=7)
        tests_this_week = TestResult.objects.filter(completed_at__gte=week_ago).count()

        return Response({
            'total_tests': total_tests,
            'avg_score': round(avg_score, 2),
            'total_users': total_users,
            'tests_today': tests_today,
            'tests_this_week': tests_this_week,
            'tests_by_position': list(tests_by_position),
            'best_results': best_results_data,
            'recent_results': recent_results_data,
        })

