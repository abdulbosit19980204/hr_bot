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
                  'test_mode', 'random_questions_count', 'show_answers_immediately',
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
                  'started_at', 'completed_at', 'time_taken', 'is_passed', 'answers']
        read_only_fields = ['started_at', 'completed_at', 'time_taken', 'score', 
                           'total_questions', 'correct_answers', 'is_passed']


class TestResultCreateSerializer(serializers.Serializer):
    test_id = serializers.IntegerField()
    answers = serializers.ListField(
        child=serializers.DictField()
    )
    time_taken = serializers.IntegerField()
    telegram_id = serializers.IntegerField(required=False, allow_null=True)  # Bot uchun
    is_trial = serializers.BooleanField(default=False)  # Trial test

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

        # Get user (from request or telegram_id)
        if telegram_id:
            try:
                user = User.objects.get(telegram_id=telegram_id)
            except User.DoesNotExist:
                raise serializers.ValidationError("User not found")
        else:
            user = request.user
            if not user.is_authenticated:
                raise serializers.ValidationError("Authentication required")

        try:
            test = Test.objects.get(id=test_id, is_active=True)
        except Test.DoesNotExist:
            raise serializers.ValidationError("Test not found or inactive")

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

        # Create test result
        result = TestResult.objects.create(
            user=user,
            test=test,
            total_questions=len(questions),
            correct_answers=0,
            time_taken=time_taken
        )

        # Process answers
        correct_answers = 0
        question_ids = {q.id for q in questions}
        
        for answer_data in answers_data:
            question_id = answer_data.get('question_id')
            option_id = answer_data.get('option_id')

            # Check if question is in test
            if question_id not in question_ids:
                continue

            try:
                question = Question.objects.get(id=question_id, test=test)
                option = AnswerOption.objects.get(id=option_id, question=question)
                
                is_correct = option.is_correct
                if is_correct:
                    correct_answers += 1

                UserAnswer.objects.create(
                    result=result,
                    question=question,
                    selected_option=option,
                    is_correct=is_correct
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

