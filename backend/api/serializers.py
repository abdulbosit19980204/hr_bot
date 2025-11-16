from rest_framework import serializers
from django.contrib.auth import get_user_model
from users.models import CV, Position, TelegramProfile
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
    
    def to_representation(self, instance):
        """Randomize options order"""
        import random
        data = super().to_representation(instance)
        options = data.get('options', [])
        if options:
            # Shuffle options randomly
            random.shuffle(options)
            data['options'] = options
        return data


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
        import random
        data = super().to_representation(instance)
        questions = data.get('questions', [])
        
        # Random questions count
        random_count = instance.random_questions_count
        if random_count > 0 and len(questions) > random_count:
            questions = random.sample(questions, random_count)
        
        # Shuffle questions order randomly
        if questions:
            random.shuffle(questions)
        
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


class TelegramProfileSerializer(serializers.ModelSerializer):
    """Telegram Profile serializer"""
    class Meta:
        model = TelegramProfile
        fields = ['telegram_id', 'telegram_first_name', 'telegram_last_name', 
                  'telegram_username', 'telegram_language_code', 'telegram_is_premium', 
                  'telegram_is_bot', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    position = PositionSerializer(read_only=True)
    position_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    tests_passed_count = serializers.SerializerMethodField()
    tests_total_count = serializers.SerializerMethodField()
    best_score = serializers.SerializerMethodField()
    telegram_profile = TelegramProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'phone', 
                  'position', 'position_id', 'telegram_id', 'telegram_profile',
                  'notification_enabled', 'is_blocked', 'blocked_reason', 
                  'trial_tests_taken', 'tests_passed_count', 'tests_total_count', 
                  'best_score', 'created_at']
        read_only_fields = ['created_at', 'is_blocked', 'blocked_reason', 'blocked_at']
    
    def get_tests_passed_count(self, obj):
        """Jami o'tgan testlar soni"""
        from tests.models import TestResult
        return TestResult.objects.filter(
            user=obj,
            is_completed=True,
            is_passed=True
        ).count()
    
    def get_tests_total_count(self, obj):
        """Jami ishlangan testlar soni"""
        from tests.models import TestResult
        return TestResult.objects.filter(
            user=obj,
            is_completed=True
        ).count()
    
    def get_best_score(self, obj):
        """Eng yaxshi ball"""
        from tests.models import TestResult
        best_result = TestResult.objects.filter(
            user=obj,
            is_completed=True
        ).order_by('-score').first()
        return best_result.score if best_result else None


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
                  'is_completed', 'is_trial', 'answers']
        read_only_fields = ['started_at', 'completed_at', 'time_taken', 'score', 
                           'total_questions', 'correct_answers', 'is_passed', 'attempt_number', 'is_completed', 'is_trial']


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
        import logging
        logger = logging.getLogger(__name__)
        
        from django.utils import timezone
        request = self.context['request']
        test_id = validated_data['test_id']
        answers_data = validated_data['answers']
        time_taken = validated_data['time_taken']
        telegram_id = validated_data.get('telegram_id')
        result_id = validated_data.get('result_id')

        # Get user (from request or telegram_id)
        if telegram_id:
            # Bot ID check - prevent bot from taking tests
            # Known bot IDs (add more if needed)
            known_bot_ids = [8357440403]  # Bot ID from error message
            
            if telegram_id in known_bot_ids:
                logger.error(f"Bot tried to submit test with its own ID: {telegram_id}")
                raise serializers.ValidationError(f"Bot cannot submit tests. Bot ID: {telegram_id}")
            
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

        # Get is_trial from validated_data BEFORE using it
        is_trial = validated_data.get('is_trial', False)

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
                is_trial=is_trial,
                started_at=timezone.now()
            )

        # Process answers - remove duplicates first
        # Group answers by question_id and keep only the last one for each question
        unique_answers = {}
        logger.info(f"Processing {len(answers_data)} answers for test {test_id}, user {user.id} (telegram_id: {user.telegram_id})")
        for idx, answer_data in enumerate(answers_data):
            question_id = answer_data.get('question_id')
            option_id = answer_data.get('option_id')
            logger.info(f"Answer {idx + 1}: question_id={question_id}, option_id={option_id}")
            if question_id and option_id:
                unique_answers[question_id] = option_id
            else:
                logger.warning(f"Invalid answer data at index {idx}: {answer_data}")
        
        logger.info(f"Unique answers after deduplication: {len(unique_answers)} answers")
        
        # Get questions based on the answers submitted (not random)
        # This ensures we check the same questions that were shown to the user
        # is_trial already defined above
        
        # Determine total questions count (how many questions should be shown to user)
        # This is used for score calculation - score should be based on total questions, not answered questions
        if is_trial:
            total_questions_count = test.trial_questions_count
        elif test.random_questions_count > 0:
            total_questions_count = test.random_questions_count
        else:
            # If no limit, use all questions count
            total_questions_count = test.questions.count()
        
        if unique_answers:
            # Get questions from the answers submitted
            # This ensures we check the exact questions that were shown to the user
            answered_question_ids = list(unique_answers.keys())
            questions = list(test.questions.filter(id__in=answered_question_ids).order_by('order', 'id'))
            logger.info(f"Getting questions from answers: {len(questions)} questions from {len(answered_question_ids)} answered question IDs")
        else:
            # Fallback to random questions if no answers provided
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
            logger.info(f"Using random questions: {len(questions)} questions (fallback)")

        # Update test result
        # total_questions should be the total number of questions that should be shown (not answered)
        result.total_questions = total_questions_count
        result.time_taken = time_taken
        
        # Process unique answers
        correct_answers = 0
        question_ids = {q.id for q in questions}
        saved_answers = []
        
        logger.info(f"Processing answers for {len(questions)} questions. Question IDs: {list(question_ids)}")
        
        # Create a mapping of question_id to question object for faster lookup
        question_map = {q.id: q for q in questions}
        
        # Save all answers
        for question_id, option_id in unique_answers.items():
            # Get question from map or fetch if not found
            question = question_map.get(question_id)
            
            if not question:
                # Question not in the initial set, try to get it
                logger.warning(f"Question {question_id} not found in questions map. Test has questions: {list(question_map.keys())}")
                try:
                    question = Question.objects.get(id=question_id, test=test)
                    # Add this question to the questions list and map
                    questions.append(question)
                    question_map[question_id] = question
                    question_ids.add(question.id)
                    result.total_questions = len(questions)
                    logger.info(f"Added question {question_id} to questions list (was answered but not in initial set)")
                except Question.DoesNotExist:
                    logger.error(f"Question {question_id} does not exist in test {test_id}")
                    continue
            
            # Get option for this question
            try:
                option = AnswerOption.objects.get(id=option_id, question=question)
                
                is_correct = option.is_correct
                if is_correct:
                    correct_answers += 1
                    logger.info(f"Correct answer: question_id={question_id}, option_id={option_id}")
                else:
                    logger.info(f"Incorrect answer: question_id={question_id}, option_id={option_id}")

                # Update or create UserAnswer (to avoid duplicate)
                user_answer, created = UserAnswer.objects.update_or_create(
                    result=result,
                    question=question,
                    defaults={
                        'selected_option': option,
                        'is_correct': is_correct
                    }
                )
                saved_answers.append({
                    'question_id': question_id,
                    'question_text': question.text,
                    'option_id': option_id,
                    'option_text': option.text,
                    'is_correct': is_correct
                })
                logger.info(f"Saved answer: question_id={question_id}, option_id={option_id}, is_correct={is_correct}")
            except Question.DoesNotExist as e:
                logger.error(f"Question not found: question_id={question_id}, test_id={test_id}, error={e}")
                continue
            except AnswerOption.DoesNotExist as e:
                logger.error(f"AnswerOption not found: question_id={question_id}, option_id={option_id}, error={e}")
                continue
            except Exception as e:
                logger.error(f"Unexpected error saving answer: question_id={question_id}, option_id={option_id}, error={e}")
                continue
        
        # Log saved answers for debugging
        logger.info(f"Saved {len(saved_answers)} answers for test {test_id}, user {user.id} (telegram_id: {user.telegram_id}), result {result.id}")
        logger.info(f"Correct answers: {correct_answers}, Total questions: {len(questions)}, User: {user.username} (ID: {user.id}, Telegram ID: {user.telegram_id})")
        
        # Ensure all questions have answers (even if not answered, save as None)
        # This ensures complete record of all questions in the test
        for question in questions:
            if question.id not in unique_answers:
                # Question was not answered - we can optionally save this too
                # For now, we'll just log it
                logger.info(f"Question {question.id} was not answered by user {user.id} (telegram_id: {user.telegram_id}) in test {test_id}")

        # Update score
        # Score should be calculated based on total_questions_count (total questions that should be shown)
        # not based on answered questions count
        # Example: If 10 questions should be shown, user answered 5 and got 3 correct = 30% (not 60%)
        score = int((correct_answers / total_questions_count) * 100) if total_questions_count > 0 else 0
        result.score = score
        result.correct_answers = correct_answers
        result.is_trial = is_trial
        # total_questions already set above to total_questions_count
        result.completed_at = timezone.now()
        result.is_completed = True
        result.save()
        
        logger.info(f"Test result saved: User {user.username} (ID: {user.id}, Telegram ID: {user.telegram_id}), Score: {score}%, Correct: {correct_answers}/{total_questions_count} (answered: {len(questions)} questions)")
        
        # Mark trial test as taken
        is_trial = validated_data.get('is_trial', False)
        if is_trial and telegram_id:
            trial_tests = user.trial_tests_taken or []
            if test.id not in trial_tests:
                trial_tests.append(test.id)
                user.trial_tests_taken = trial_tests
                user.save()

        return result

