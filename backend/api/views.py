from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.db.models import Q, Count, Avg
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.utils import timezone
from datetime import timedelta

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
        
        if self.action == 'retrieve':
            return queryset.prefetch_related('questions__options', 'positions')
        return queryset.prefetch_related('positions')

    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        test = self.get_object()
        questions = test.questions.all().prefetch_related('options')
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)


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
                        setattr(user, key, request.data[key])
                
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
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['user']
    ordering_fields = ['uploaded_at']
    ordering = ['-uploaded_at']

    def get_queryset(self):
        if self.request.user.is_staff:
            return CV.objects.all()
        return CV.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TestResultViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
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
        if self.request.user.is_staff:
            return TestResult.objects.all().select_related('user', 'test')
        return TestResult.objects.filter(user=self.request.user).select_related('user', 'test')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(TestResultSerializer(result).data, status=status.HTTP_201_CREATED)


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

