from rest_framework import serializers
from django.contrib.auth import get_user_model
from users.models import CV, Position
from tests.models import Test, Question, AnswerOption, TestResult, UserAnswer

User = get_user_model()


class PositionSerializer(serializers.ModelSerializer):
    """Position serializer"""
    tests_count = serializers.IntegerField(source='tests.count', read_only=True)
    
    class Meta:
        model = Position
        fields = ['id', 'name', 'description', 'is_open', 'tests_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class AnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerOption
        fields = ['id', 'text', 'is_correct', 'order']
        read_only_fields = ['is_correct']


class QuestionSerializer(serializers.ModelSerializer):
    options = AnswerOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'order', 'options']


class TestSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)
    positions = PositionSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = ['id', 'title', 'description', 'positions', 'time_limit', 'passing_score', 
                  'test_mode', 'random_questions_count', 'show_answers_immediately',
                  'trial_questions_count', 'is_active', 'questions', 'questions_count', 
                  'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def to_representation(self, instance):
        """Random questions tanlash va test mode'ga qarab filter qilish"""
        data = super().to_representation(instance)
        questions = data.get('questions', [])
        
        # Random questions count
        random_count = instance.random_questions_count
        if random_count > 0 and len(questions) > random_count:
            import random
            questions = random.sample(questions, random_count)
            data['questions'] = questions
        
        return data


class TestListSerializer(serializers.ModelSerializer):
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)
    positions = PositionSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = ['id', 'title', 'description', 'positions', 'time_limit', 'passing_score', 
                  'test_mode', 'max_attempts', 'random_questions_count', 'show_answers_immediately',
                  'trial_questions_count', 'is_active', 'questions_count', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    position = PositionSerializer(read_only=True)
    position_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'phone', 
                  'position', 'position_id', 'telegram_id', 'is_blocked', 
                  'blocked_reason', 'trial_tests_taken', 'created_at']
        read_only_fields = ['created_at', 'is_blocked', 'blocked_reason', 'blocked_at']


class UserCreateSerializer(serializers.ModelSerializer):
    position_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email', 'phone', 
                  'telegram_id', 'password', 'position_id']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        position_id = validated_data.pop('position_id', None)
        
        if not password:
            password = User.objects.make_random_password()
        
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        
        # Set position if provided and valid (faqat ochiq positionlar)
        if position_id:
            try:
                position = Position.objects.get(id=position_id, is_open=True)
                user.position = position
            except Position.DoesNotExist:
                # Position topilmadi yoki yopiq - position o'rnatilmaydi
                pass
        
        user.save()
        return user


class CVSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = CV
        fields = ['id', 'user', 'file', 'file_name', 'file_size', 'uploaded_at']
        read_only_fields = ['file_name', 'file_size', 'uploaded_at']

    def create(self, validated_data):
        file = validated_data['file']
        validated_data['file_name'] = file.name
        validated_data['file_size'] = file.size
        return super().create(validated_data)


class UserAnswerSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)
    selected_option = AnswerOptionSerializer(read_only=True)
    selected_option_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = UserAnswer
        fields = ['id', 'question', 'selected_option', 'selected_option_id', 'is_correct']
        read_only_fields = ['is_correct']


class TestResultSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    test = TestListSerializer(read_only=True)
    answers = UserAnswerSerializer(many=True, read_only=True)
    is_passed = serializers.BooleanField(read_only=True)

    class Meta:
        model = TestResult
        fields = ['id', 'user', 'test', 'score', 'total_questions', 'correct_answers', 
                  'started_at', 'completed_at', 'time_taken', 'is_passed', 'attempt_number', 
                  'is_completed', 'answers']
        read_only_fields = ['started_at', 'completed_at', 'time_taken', 'score', 
                           'total_questions', 'correct_answers', 'is_passed', 'attempt_number', 'is_completed']


class TestResultCreateSerializer(serializers.Serializer):
    test_id = serializers.IntegerField()
    answers = serializers.ListField(
        child=serializers.DictField()
    )
    time_taken = serializers.IntegerField()
    telegram_id = serializers.IntegerField(required=False, allow_null=True)  # Bot uchun
    is_trial = serializers.BooleanField(default=False)  # Trial test
    result_id = serializers.IntegerField(required=False, allow_null=True)  # Resume existing test

    def validate_answers(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Answers must be a list")
        return value

    def create(self, validated_data):
        from django.utils import timezone
        request = self.context['request']
        test_id = validated_data['test_id']
        answers_data = validated_data['answers']
        time_taken = validated_data['time_taken']
        telegram_id = validated_data.get('telegram_id')
        result_id = validated_data.get('result_id')

        # Get user (from request or telegram_id)
        if telegram_id:
            # Check if this is bot's own telegram_id (prevent bot from taking tests)
            import os
            from django.conf import settings
            bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
            if bot_token:
                try:
                    import requests
                    bot_info = requests.get(f"https://api.telegram.org/bot{bot_token}/getMe", timeout=2)
                    if bot_info.status_code == 200:
                        bot_data = bot_info.json()
                        if bot_data.get('ok') and bot_data.get('result', {}).get('id') == telegram_id:
                            raise serializers.ValidationError("Bot o'zi test yubora olmaydi")
                except Exception:
                    pass  # Ignore errors in bot ID check
            
            try:
                user = User.objects.get(telegram_id=telegram_id)
            except User.DoesNotExist:
                # Create user if not exists (for Telegram bot)
                user = User.objects.create_user(
                    username=f'user_{telegram_id}',
                    telegram_id=telegram_id,
                    first_name='',
                    last_name=''
                )
        else:
            user = request.user
            if not user.is_authenticated:
                raise serializers.ValidationError("Authentication required")

        try:
            test = Test.objects.get(id=test_id, is_active=True)
        except Test.DoesNotExist:
            raise serializers.ValidationError("Test not found or inactive")

        # Get or create test result
        if result_id:
            # Resume existing test
            try:
                result = TestResult.objects.get(id=result_id, user=user, test=test, is_completed=False)
            except TestResult.DoesNotExist:
                raise serializers.ValidationError("Test result not found or already completed")
        else:
            # Create new test result
            attempt_number = TestResult.objects.filter(user=user, test=test).count() + 1
            result = TestResult.objects.create(
                user=user,
                test=test,
                total_questions=0,
                correct_answers=0,
                score=0,
                time_taken=0,
                attempt_number=attempt_number,
                is_completed=False,
                started_at=timezone.now()
            )

        # Get questions (random if configured or trial)
        is_trial = validated_data.get('is_trial', False)
        questions = list(test.questions.all().order_by('order', 'id'))
        
        if is_trial:
            # Trial test - use trial_questions_count
            trial_count = test.trial_questions_count
            if len(questions) > trial_count:
                import random
                questions = random.sample(questions, trial_count)
        elif test.random_questions_count > 0:
            # Regular test - use random_questions_count
            if len(questions) > test.random_questions_count:
                import random
                questions = random.sample(questions, test.random_questions_count)

        # Update test result
        result.total_questions = len(questions)
        result.time_taken = time_taken

        # Process answers - remove duplicates first
        # Group answers by question_id and keep only the last one for each question
        unique_answers = {}
        for answer_data in answers_data:
            question_id = answer_data.get('question_id')
            option_id = answer_data.get('option_id')
            if question_id and option_id:
                unique_answers[question_id] = option_id
        
        # Process unique answers
        correct_answers = 0
        question_ids = {q.id for q in questions}
        
        for question_id, option_id in unique_answers.items():
            # Check if question is in test
            if question_id not in question_ids:
                continue

            try:
                question = Question.objects.get(id=question_id, test=test)
                option = AnswerOption.objects.get(id=option_id, question=question)
                
                is_correct = option.is_correct
                if is_correct:
                    correct_answers += 1

                # Update or create UserAnswer (to avoid duplicate)
                UserAnswer.objects.update_or_create(
                    result=result,
                    question=question,
                    defaults={
                        'selected_option': option,
                        'is_correct': is_correct
                    }
                )
            except (Question.DoesNotExist, AnswerOption.DoesNotExist):
                continue

        # Update score
        total_questions = len(questions)
        score = int((correct_answers / total_questions) * 100) if total_questions > 0 else 0
        result.score = score
        result.correct_answers = correct_answers
        result.total_questions = total_questions
        result.completed_at = timezone.now()
        result.is_completed = True
        result.save()
        
        # Mark trial test as taken
        is_trial = validated_data.get('is_trial', False)
        if is_trial and telegram_id:
            trial_tests = user.trial_tests_taken or []
            if test.id not in trial_tests:
                trial_tests.append(test.id)
                user.trial_tests_taken = trial_tests
                user.save()

        return result

