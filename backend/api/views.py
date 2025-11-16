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
from django.http import HttpResponse
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
import random
import logging
import asyncio

logger = logging.getLogger(__name__)

from users.models import CV, Position, TelegramProfile, Notification
from users.services import send_telegram_message_async, send_notification_to_users
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
    queryset = Test.objects.all().prefetch_related('questions__options', 'positions')
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
    
    def get_permissions(self):
        """
        AllowAny for list/retrieve, IsAuthenticated + is_superuser for create/update/delete
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            from rest_framework.permissions import IsAuthenticated
            return [IsAuthenticated()]
        return [AllowAny()]
    
    def create(self, request, *args, **kwargs):
        """Create test - only for superusers"""
        if not request.user.is_authenticated or not request.user.is_superuser:
            return Response(
                {'error': 'Permission denied. Superuser access required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        """Update test - only for superusers"""
        if not request.user.is_authenticated or not request.user.is_superuser:
            return Response(
                {'error': 'Permission denied. Superuser access required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Delete test - only for superusers"""
        if not request.user.is_authenticated or not request.user.is_superuser:
            return Response(
                {'error': 'Permission denied. Superuser access required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by is_active if provided, otherwise return all tests
        # DjangoFilterBackend will handle is_active filter automatically via filterset_fields
        # But we need to ensure default behavior doesn't filter by is_active
        # The filterset_fields=['is_active'] will handle filtering when is_active param is provided
        
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
        
        # Filter out tests where user has used all attempts
        telegram_id = self.request.query_params.get('telegram_id')
        if telegram_id and self.action == 'list':
            try:
                user = User.objects.get(telegram_id=telegram_id)
                # Get tests where user has completed all attempts
                from tests.models import TestResult
                
                # Get test IDs where user has completed max_attempts (for real tests only)
                completed_tests = []
                for test in queryset:
                    # Check real test attempts (not trial)
                    completed_count = TestResult.objects.filter(
                        user=user,
                        test=test,
                        is_trial=False,
                        is_completed=True
                    ).count()
                    if completed_count >= test.max_attempts:
                        completed_tests.append(test.id)
                
                # Exclude tests where all attempts are used
                if completed_tests:
                    queryset = queryset.exclude(id__in=completed_tests)
            except User.DoesNotExist:
                pass
        
        if self.action == 'retrieve':
            return queryset.prefetch_related('questions__options', 'positions')
        return queryset.prefetch_related('positions')
    
    @action(detail=True, methods=['get'])
    def questions_list(self, request, pk=None):
        """Get all test questions with pagination (for superusers only)"""
        from rest_framework.pagination import PageNumberPagination
        from rest_framework.permissions import IsAdminUser
        
        # Check if user is superuser
        if not request.user.is_authenticated or not request.user.is_superuser:
            return Response(
                {'error': 'Permission denied. Superuser access required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        test = self.get_object()
        questions = test.questions.all().prefetch_related('options').order_by('order', 'id')
        
        # Pagination with custom page size
        paginator = PageNumberPagination()
        page_size = request.query_params.get('page_size', '20')
        try:
            page_size = int(page_size)
            if page_size < 1:
                page_size = 20
            if page_size > 100:  # Max limit
                page_size = 100
        except (ValueError, TypeError):
            page_size = 20
        paginator.page_size = page_size
        paginated_questions = paginator.paginate_queryset(questions, request)
        
        serializer = QuestionSerializer(paginated_questions, many=True, context={'admin_view': True, 'request': request})
        return paginator.get_paginated_response(serializer.data)
    
    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def export_questions(self, request, pk=None):
        """Export questions to Excel file - only for superusers"""
        if not request.user.is_authenticated or not request.user.is_superuser:
            return Response(
                {'error': 'Permission denied. Superuser access required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        test = self.get_object()
        
        try:
            # Get all questions
            questions = test.questions.all().prefetch_related('options').order_by('order', 'id')
            
            # Create workbook
            wb = Workbook()
            ws = wb.active
            ws.title = "Test Questions"
            
            # Test info
            ws.cell(row=1, column=1).value = "Test ID:"
            ws.cell(row=1, column=2).value = test.id
            ws.cell(row=2, column=1).value = "Test nomi:"
            ws.cell(row=2, column=2).value = test.title
            ws.cell(row=3, column=1).value = "Tavsif:"
            ws.cell(row=3, column=2).value = test.description or ""
            ws.cell(row=4, column=1).value = "Savollar soni:"
            ws.cell(row=4, column=2).value = questions.count()
            
            # Empty row
            row = 6
            
            # Headers
            headers = ['Savol', 'Variant 1', 'Variant 2', 'Variant 3', 'Variant 4', 'To\'g\'ri javob']
            for col, header in enumerate(headers, start=1):
                cell = ws.cell(row=row, column=col)
                cell.value = header
                cell.font = Font(bold=True)
                cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")
                cell.alignment = Alignment(horizontal="center", vertical="center")
            
            row += 1
            
            # Questions
            for question in questions:
                options = list(question.options.all().order_by('order', 'id'))
                correct_option_num = None
                
                # Find correct option number
                for idx, opt in enumerate(options[:4], start=1):
                    if opt.is_correct:
                        correct_option_num = idx
                        break
                
                # Question text
                ws.cell(row=row, column=1).value = question.text
                
                # Options (max 4)
                for idx, opt in enumerate(options[:4], start=1):
                    ws.cell(row=row, column=idx + 1).value = opt.text
                
                # Correct answer
                ws.cell(row=row, column=6).value = correct_option_num if correct_option_num else ""
                
                row += 1
            
            # Auto-adjust column widths
            for col in range(1, 7):
                ws.column_dimensions[chr(64 + col)].width = 30
            
            # Create response
            response = HttpResponse(
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            filename = f"test_{test.id}_questions_{timezone.now().strftime('%Y%m%d')}.xlsx"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            wb.save(response)
            return response
            
        except Exception as e:
            logger.error(f'Error exporting questions: {str(e)}')
            return Response(
                {'error': f'Export failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def import_questions(self, request, pk=None):
        """Import questions from Excel file - only for superusers"""
        if not request.user.is_authenticated or not request.user.is_superuser:
            return Response(
                {'error': 'Permission denied. Superuser access required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        test = self.get_object()
        
        try:
            if 'file' not in request.FILES:
                return Response(
                    {'error': 'Excel file is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            excel_file = request.FILES['file']
            
            # Load workbook
            wb = load_workbook(excel_file, data_only=True)
            ws = wb.active
            
            imported_count = 0
            errors = []
            
            # Find questions start row (skip test info, find headers)
            start_row = 1
            for row in range(1, 20):
                if ws.cell(row=row, column=1).value and 'Savol' in str(ws.cell(row=row, column=1).value):
                    start_row = row + 1
                    break
            
            # Process questions
            for row in range(start_row, ws.max_row + 1):
                question_text = ws.cell(row=row, column=1).value
                
                # Skip empty rows
                if not question_text or not str(question_text).strip():
                    continue
                
                try:
                    # Get options
                    options = []
                    for col in range(2, 6):  # Columns B-E (variants 1-4)
                        option_text = ws.cell(row=row, column=col).value
                        if option_text and str(option_text).strip():
                            options.append(str(option_text).strip())
                    
                    if not options:
                        errors.append(f"Qator {row}: Variantlar topilmadi")
                        continue
                    
                    # Get correct answer
                    correct_answer = ws.cell(row=row, column=6).value
                    correct_option_num = None
                    if correct_answer:
                        try:
                            correct_option_num = int(correct_answer)
                        except (ValueError, TypeError):
                            pass
                    
                    if not correct_option_num or correct_option_num < 1 or correct_option_num > len(options):
                        errors.append(f"Qator {row}: To'g'ri javob noto'g'ri (1-{len(options)} orasida bo'lishi kerak)")
                        continue
                    
                    # Create question
                    question = Question.objects.create(
                        test=test,
                        text=str(question_text).strip(),
                        order=imported_count
                    )
                    
                    # Create answer options
                    for idx, opt_text in enumerate(options, start=1):
                        AnswerOption.objects.create(
                            question=question,
                            text=opt_text,
                            is_correct=(idx == correct_option_num),
                            order=idx - 1
                        )
                    
                    imported_count += 1
                    
                except Exception as e:
                    errors.append(f"Qator {row}: {str(e)}")
            
            return Response({
                'success': True,
                'imported_count': imported_count,
                'errors': errors if errors else None
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f'Error importing questions: {str(e)}')
            return Response(
                {'error': f'Import failed: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
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
                
                # Check trial test attempts
                if is_trial:
                    # Check trial attempts count (main check based on completed results)
                    trial_results = TestResult.objects.filter(
                        user=user,
                        test=test,
                        is_trial=True,
                        is_completed=True
                    ).count()
                    
                    if trial_results >= test.max_trial_attempts:
                        return Response(
                            {
                                'error': 'All trial attempts used',
                                'message': f'Siz trial testni {trial_results} marta ishlagansiz. Ruxsat etilgan urinishlar soni: {test.max_trial_attempts}',
                                'attempts_used': trial_results,
                                'max_trial_attempts': test.max_trial_attempts
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )
                else:
                    # Check real test attempts
                    completed_results = TestResult.objects.filter(
                        user=user,
                        test=test,
                        is_trial=False,
                        is_completed=True
                    ).count()
                    
                    if completed_results >= test.max_attempts:
                        return Response(
                            {
                                'error': 'All attempts used',
                                'message': f'Siz bu testni {completed_results} marta ishlagansiz. Ruxsat etilgan urinishlar soni: {test.max_attempts}',
                                'attempts_used': completed_results,
                                'max_attempts': test.max_attempts
                            },
                            status=status.HTTP_400_BAD_REQUEST
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
        
        # Shuffle questions order randomly
        questions = list(questions)
        random.shuffle(questions)
        
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def start_test(self, request, pk=None):
        """Start test session or resume existing test"""
        from django.utils import timezone
        from datetime import timedelta
        
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
                
                # Check trial test attempts
                if is_trial:
                    # Check trial attempts count (main check based on completed results)
                    trial_results = TestResult.objects.filter(
                        user=user,
                        test=test,
                        is_trial=True,
                        is_completed=True
                    ).count()
                    
                    if trial_results >= test.max_trial_attempts:
                        return Response(
                            {
                                'error': 'All trial attempts used',
                                'message': f'Siz trial testni {trial_results} marta ishlagansiz. Ruxsat etilgan urinishlar soni: {test.max_trial_attempts}',
                                'attempts_used': trial_results,
                                'max_trial_attempts': test.max_trial_attempts
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )
                else:
                    # Check real test attempts
                    completed_results = TestResult.objects.filter(
                        user=user,
                        test=test,
                        is_trial=False,
                        is_completed=True
                    ).count()
                    
                    if completed_results >= test.max_attempts:
                        return Response(
                            {
                                'error': 'All attempts used',
                                'message': f'Siz bu testni {completed_results} marta ishlagansiz. Ruxsat etilgan urinishlar soni: {test.max_attempts}',
                                'attempts_used': completed_results,
                                'max_attempts': test.max_attempts
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )
                
                # Check if user has uploaded CV for this test (if passed)
                # If CV is uploaded, don't allow retaking the test
                from users.models import CV
                from tests.models import TestResult
                passed_results = TestResult.objects.filter(
                    user=user,
                    test=test,
                    is_completed=True,
                    score__gte=test.passing_score
                ).exists()
                
                if passed_results:
                    # Check if CV is uploaded
                    has_cv = CV.objects.filter(user=user).exists()
                    if has_cv:
                        return Response(
                            {'error': 'CV already uploaded. Test cannot be retaken.'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                
                # Check for incomplete test (resume)
                incomplete_result = TestResult.objects.filter(
                    user=user,
                    test=test,
                    is_completed=False
                ).order_by('-started_at').first()
                
                if incomplete_result:
                    # Check if test time limit has expired
                    time_elapsed = (timezone.now() - incomplete_result.started_at).total_seconds() / 60
                    if time_elapsed < test.time_limit:
                        # Resume existing test
                        return Response({
                            'session_token': str(incomplete_result.id),  # Use result ID as session token
                            'test_id': test.id,
                            'time_limit': test.time_limit,
                            'time_elapsed': int(time_elapsed),
                            'time_remaining': int(test.time_limit - time_elapsed),
                            'is_trial': is_trial,
                            'resume': True,
                            'result_id': incomplete_result.id,
                            'attempt_number': incomplete_result.attempt_number
                        })
                    else:
                        # Time expired, mark as completed
                        incomplete_result.is_completed = True
                        incomplete_result.completed_at = timezone.now()
                        incomplete_result.save()
                
                # Start new test attempt
                attempt_number = TestResult.objects.filter(
                    user=user,
                    test=test
                ).count() + 1
                
                # Create new test result (incomplete)
                from tests.models import TestResult
                new_result = TestResult.objects.create(
                    user=user,
                    test=test,
                    score=0,
                    total_questions=0,
                    correct_answers=0,
                    time_taken=0,
                    attempt_number=attempt_number,
                    is_completed=False,
                    is_trial=is_trial,
                    started_at=timezone.now()
                )
                
                # Generate test session token
                import uuid
                session_token = str(uuid.uuid4())
                
                return Response({
                    'session_token': session_token,
                    'test_id': test.id,
                    'time_limit': test.time_limit,
                    'is_trial': is_trial,
                    'resume': False,
                    'result_id': new_result.id,
                    'attempt_number': attempt_number
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
    def notify_page_leave(self, request, pk=None):
        """Notify about page leave attempt during test"""
        test = self.get_object()
        telegram_id = request.data.get('telegram_id')
        attempts = request.data.get('attempts', 1)
        test_id = request.data.get('test_id')
        
        if not telegram_id:
            return Response(
                {'error': 'telegram_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(telegram_id=telegram_id)
            
            # Log page leave attempt
            test_title = test.title if test else 'Unknown'
            
            # Send notification to admin (log as ERROR for visibility)
            if attempts >= 2:
                logger.error(
                    f"🚨 CRITICAL: User attempted to leave test page {attempts} times - "
                    f"User: {user.first_name} {user.last_name} (ID: {user.id}, Telegram ID: {telegram_id}), "
                    f"Test: {test_title} (ID: {test_id or pk})"
                )
            else:
                logger.warning(
                    f"⚠️ Page leave attempt: User {user.first_name} {user.last_name} "
                    f"(Telegram ID: {telegram_id}) attempted to leave test page {attempts} time(s) - "
                    f"Test: {test_title} (ID: {test_id or pk})"
                )
            
            # If 2+ attempts, block user immediately
            if attempts >= 2:
                user.is_blocked = True
                user.blocked_reason = f"Test tark etildi (cheating) - {attempts} marta urinish"
                user.blocked_at = timezone.now()
                user.save()
                
                logger.error(
                    f"🚨 User blocked due to page leave: user_id={user.id}, "
                    f"telegram_id={telegram_id}, test_id={test_id or pk}, attempts={attempts}, "
                    f"reason: {user.blocked_reason}"
                )
                
                # Try to send notification to Telegram bot admin group
                # This is done via logging - Telegram bot can monitor logs or we can add webhook
                # For now, we'll log it and the bot's admin notification system will handle it
                
                return Response({
                    'message': 'User blocked due to multiple page leave attempts',
                    'blocked': True,
                    'reason': user.blocked_reason
                }, status=status.HTTP_200_OK)
            
            return Response({
                'message': 'Page leave attempt logged',
                'attempts': attempts,
                'blocked': False
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error notifying page leave: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
        """Authenticate user by Telegram ID and update Telegram info"""
        telegram_id = request.data.get('telegram_id')
        if not telegram_id:
            return Response({'error': 'telegram_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(telegram_id=telegram_id)
            # Update TelegramProfile, not User's first_name/last_name
            try:
                telegram_profile = TelegramProfile.objects.get(telegram_id=telegram_id)
                # Update existing profile
                telegram_profile.user = user
            except TelegramProfile.DoesNotExist:
                # Create new profile
                telegram_profile = TelegramProfile.objects.create(
                    user=user,
                    telegram_id=telegram_id,
                    telegram_is_premium=False,
                    telegram_is_bot=False
                )
            
            # Update TelegramProfile info if provided
            if 'telegram_username' in request.data:
                telegram_profile.telegram_username = request.data.get('telegram_username')
            if 'telegram_language_code' in request.data:
                telegram_profile.telegram_language_code = request.data.get('telegram_language_code')
            
            # Always ensure telegram_is_premium is set (NOT NULL constraint)
            # Set it explicitly to avoid None values
            if 'telegram_is_premium' in request.data:
                telegram_profile.telegram_is_premium = bool(request.data.get('telegram_is_premium', False))
            else:
                # If not provided, ensure it's set to False (not None)
                telegram_profile.telegram_is_premium = False if telegram_profile.telegram_is_premium is None else bool(telegram_profile.telegram_is_premium)
            
            # Always ensure telegram_is_bot is set (NOT NULL constraint)
            telegram_profile.telegram_is_bot = False if telegram_profile.telegram_is_bot is None else bool(telegram_profile.telegram_is_bot)
            
            # Update telegram first_name and last_name (NOT User's first_name/last_name)
            if 'first_name' in request.data:
                telegram_first_name = request.data.get('first_name', '')
                telegram_profile.telegram_first_name = telegram_first_name if telegram_first_name is not None else ''
            if 'last_name' in request.data:
                telegram_last_name = request.data.get('last_name', '')
                telegram_profile.telegram_last_name = telegram_last_name if telegram_last_name is not None else ''
            
            # Update user's telegram_id if not set
            if not user.telegram_id:
                user.telegram_id = telegram_id
                user.save()
            
            telegram_profile.save()
            
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': UserSerializer(user).data
            })
        except User.DoesNotExist:
            # Create user if not exists (without telegram first_name/last_name)
            user = User.objects.create_user(
                username=f'user_{telegram_id}',
                telegram_id=telegram_id,
                # Don't set first_name/last_name from telegram - user will fill it during registration
                first_name='',
                last_name=''
            )
            
            # Create TelegramProfile with telegram info
            telegram_first_name = request.data.get('first_name', '') or ''
            telegram_last_name = request.data.get('last_name', '') or ''
            if telegram_first_name is None:
                telegram_first_name = ''
            if telegram_last_name is None:
                telegram_last_name = ''
            
            telegram_profile = TelegramProfile.objects.create(
                user=user,
                telegram_id=telegram_id,
                telegram_first_name=telegram_first_name,
                telegram_last_name=telegram_last_name,
                telegram_username=request.data.get('telegram_username'),
                telegram_language_code=request.data.get('telegram_language_code'),
                telegram_is_premium=request.data.get('telegram_is_premium', False),
                telegram_is_bot=False
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
                        # None ni bo'sh stringga o'zgartirish (Django NOT NULL constraint uchun)
                        if value is None:
                            value = ''
                        # first_name bo'sh bo'lmasligi kerak
                        if key == 'first_name' and not value:
                            value = user.first_name or 'User'
                        # last_name None bo'lmasligi kerak (bo'sh string bo'lishi mumkin)
                        if key == 'last_name' and value is None:
                            value = ''
                        setattr(user, key, value)
                
                # first_name bo'sh bo'lsa, default qo'yish
                if not user.first_name:
                    user.first_name = request.data.get('first_name', 'User') or 'User'
                
                # last_name None bo'lmasligi kerak (bo'sh string bo'lishi mumkin)
                if user.last_name is None:
                    user.last_name = ''
                
                # Handle position (can be position_id)
                if 'position_id' in request.data:
                    position_id = request.data.get('position_id')
                    if position_id:
                        try:
                            # Allow setting position even if it's not open (for premium users or admin)
                            position = Position.objects.get(id=position_id)
                            user.position = position
                        except Position.DoesNotExist:
                            pass
                
                user.save()
                
                # Update or create TelegramProfile
                try:
                    telegram_profile = TelegramProfile.objects.get(telegram_id=telegram_id)
                    # Update existing profile
                    telegram_profile.user = user
                except TelegramProfile.DoesNotExist:
                    # Create new profile
                    telegram_first_name = request.data.get('telegram_first_name', '') or ''
                    telegram_last_name = request.data.get('telegram_last_name', '') or ''
                    if telegram_first_name is None:
                        telegram_first_name = ''
                    if telegram_last_name is None:
                        telegram_last_name = ''
                    
                    telegram_profile = TelegramProfile.objects.create(
                        user=user,
                        telegram_id=telegram_id,
                        telegram_first_name=telegram_first_name,
                        telegram_last_name=telegram_last_name,
                        telegram_username=request.data.get('telegram_username'),
                        telegram_language_code=request.data.get('telegram_language_code'),
                        telegram_is_premium=request.data.get('telegram_is_premium', False),
                        telegram_is_bot=False
                    )
                
                # Update TelegramProfile with telegram data if provided
                if 'telegram_first_name' in request.data:
                    telegram_profile.telegram_first_name = request.data.get('telegram_first_name', '')
                if 'telegram_last_name' in request.data:
                    telegram_profile.telegram_last_name = request.data.get('telegram_last_name', '')
                if 'telegram_username' in request.data:
                    telegram_profile.telegram_username = request.data.get('telegram_username')
                if 'telegram_language_code' in request.data:
                    telegram_profile.telegram_language_code = request.data.get('telegram_language_code')
                
                # Always ensure telegram_is_premium is set (NOT NULL constraint)
                # Set it explicitly to avoid None values
                if 'telegram_is_premium' in request.data:
                    telegram_profile.telegram_is_premium = bool(request.data.get('telegram_is_premium', False))
                else:
                    # If not provided, ensure it's set to False (not None)
                    telegram_profile.telegram_is_premium = False if telegram_profile.telegram_is_premium is None else bool(telegram_profile.telegram_is_premium)
                
                # Always ensure telegram_is_bot is set (NOT NULL constraint)
                telegram_profile.telegram_is_bot = False if telegram_profile.telegram_is_bot is None else bool(telegram_profile.telegram_is_bot)
                
                telegram_profile.save()
                
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
        
        # Ensure first_name and last_name are not None (use empty string instead)
        first_name = request.data.get('first_name', '') or ''
        last_name = request.data.get('last_name', '') or ''
        if first_name is None:
            first_name = ''
        if last_name is None:
            last_name = ''
        
        user_data = {
            'username': username,
            'telegram_id': telegram_id,
            'first_name': first_name,
            'last_name': last_name,
            'email': request.data.get('email', '') or '',
            'phone': request.data.get('phone', '') or '',
            'password': password
        }
        
        # Handle position
        if 'position_id' in request.data:
            position_id = request.data.get('position_id')
            if position_id:
                try:
                    # Allow setting position even if it's not open (for premium users or admin)
                    position = Position.objects.get(id=position_id)
                    user_data['position_id'] = position.id
                except Position.DoesNotExist:
                    pass
        
        serializer = UserCreateSerializer(data=user_data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Create TelegramProfile for new user (if not exists)
            try:
                telegram_profile = TelegramProfile.objects.get(telegram_id=telegram_id)
                # Update existing profile
                telegram_profile.user = user
            except TelegramProfile.DoesNotExist:
                # Create new profile
                telegram_first_name = request.data.get('telegram_first_name', '') or ''
                telegram_last_name = request.data.get('telegram_last_name', '') or ''
                if telegram_first_name is None:
                    telegram_first_name = ''
                if telegram_last_name is None:
                    telegram_last_name = ''
                
                telegram_profile = TelegramProfile.objects.create(
                    user=user,
                    telegram_id=telegram_id,
                    telegram_first_name=telegram_first_name,
                    telegram_last_name=telegram_last_name,
                    telegram_username=request.data.get('telegram_username'),
                    telegram_language_code=request.data.get('telegram_language_code'),
                    telegram_is_premium=request.data.get('telegram_is_premium', False),
                    telegram_is_bot=False
                )
            
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
            return TestResult.objects.filter(is_completed=True).select_related('user', 'test')
        
        # Telegram ID bo'yicha filter (bot uchun)
        telegram_id = self.request.query_params.get('user__telegram_id')
        if telegram_id:
            return TestResult.objects.filter(
                user__telegram_id=telegram_id,
                is_completed=True
            ).select_related('user', 'test')
        
        # Authenticated user uchun faqat o'z natijalari
        if self.request.user.is_authenticated:
            return TestResult.objects.filter(
                user=self.request.user,
                is_completed=True
            ).select_related('user', 'test')
        
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
    """Statistics view - AllowAny permission for frontend access"""
    permission_classes = [AllowAny]  # Frontend uchun ochiq qildik
    authentication_classes = []  # Authentication talab qilmaymiz

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


class NotificationView(APIView):
    """Send notification to selected users"""
    permission_classes = [IsAuthenticated]  # Faqat authenticated userlar
    
    def post(self, request):
        """
        Send notification to selected users
        Expected data:
        {
            "user_ids": [1, 2, 3],
            "title": "Suxbat taklifi",
            "message": "Sizni suxbatga taklif qilamiz...",
            "notification_type": "interview" or "job_offer"
        }
        """
        user_ids = request.data.get('user_ids', [])
        title = request.data.get('title', '')
        message = request.data.get('message', '')
        notification_type = request.data.get('notification_type', 'interview')  # 'interview' or 'job_offer'
        
        if not user_ids:
            return Response(
                {'error': 'user_ids is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not title or not message:
            return Response(
                {'error': 'title and message are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get users
            users = User.objects.filter(id__in=user_ids, telegram_id__isnull=False)
            if not users.exists():
                return Response(
                    {'error': 'No users found with telegram_id'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Format message based on notification type
            formatted_message = message
            if notification_type == 'interview':
                # Suxbat taklifi uchun format
                formatted_message = f"🎯 <b>Suxbat taklifi</b>\n\n{message}"
            elif notification_type == 'job_offer':
                # Ishga taklif uchun format
                formatted_message = f"💼 <b>Ishga taklif</b>\n\n{message}"
            elif notification_type == 'encouragement':
                # Tashakkur va rag'batlantirish uchun format
                formatted_message = f"🙏 <b>Tashakkur</b>\n\n{message}"
            
            # Create notification
            notification = Notification.objects.create(
                title=title,
                message=formatted_message,
                send_to_all=False,
                created_by=request.user if request.user.is_authenticated else None
            )
            
            # Add recipients
            notification.recipients.set(users)
            
            # Send notifications
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(send_notification_to_users(notification))
            loop.close()
            
            # Update notification stats
            notification.sent_at = timezone.now()
            notification.total_recipients = result['total']
            notification.successful_sends = result['successful']
            notification.failed_sends = result['failed']
            notification.save()
            
            return Response({
                'success': True,
                'message': 'Notification sent successfully',
                'total': result['total'],
                'successful': result['successful'],
                'failed': result['failed'],
                'notification_id': notification.id
            })
            
        except Exception as e:
            logger.error(f"Error sending notification: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
