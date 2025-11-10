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
                  'is_active', 'questions', 'questions_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class TestListSerializer(serializers.ModelSerializer):
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)
    positions = PositionSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = ['id', 'title', 'description', 'positions', 'time_limit', 'passing_score', 
                  'is_active', 'questions_count', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    position = PositionSerializer(read_only=True)
    position_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'phone', 
                  'position', 'position_id', 'telegram_id', 'created_at']
        read_only_fields = ['created_at']


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
        child=serializers.DictField(
            child=serializers.IntegerField()
        )
    )
    time_taken = serializers.IntegerField()

    def validate_answers(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Answers must be a list")
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        test_id = validated_data['test_id']
        answers_data = validated_data['answers']
        time_taken = validated_data['time_taken']

        try:
            test = Test.objects.get(id=test_id, is_active=True)
        except Test.DoesNotExist:
            raise serializers.ValidationError("Test not found or inactive")

        # Calculate score
        total_questions = test.questions.count()
        correct_answers = 0

        # Create test result
        result = TestResult.objects.create(
            user=user,
            test=test,
            total_questions=total_questions,
            correct_answers=0,
            time_taken=time_taken
        )

        # Process answers
        for answer_data in answers_data:
            question_id = answer_data.get('question_id')
            option_id = answer_data.get('option_id')

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

        # Update result
        score = int((correct_answers / total_questions * 100)) if total_questions > 0 else 0
        result.correct_answers = correct_answers
        result.score = score
        result.save()

        return result

