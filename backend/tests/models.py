from django.db import models
from django.utils.translation import gettext_lazy as _
from users.models import User


class Test(models.Model):
    """Test model"""
    TEST_MODE_CHOICES = [
        ('webapp', _('WebApp')),
        ('telegram', _('Telegram')),
        ('both', _('Both (WebApp and Telegram)')),
    ]
    
    title = models.CharField(max_length=255, verbose_name=_('Title'))
    description = models.TextField(blank=True, null=True, verbose_name=_('Description'))
    positions = models.ManyToManyField('users.Position', related_name='tests', blank=True, verbose_name=_('Positions'), help_text=_('Test qaysi positionlar uchun mo\'ljallangan'))
    time_limit = models.IntegerField(default=60, help_text=_('Time limit in minutes'), verbose_name=_('Time Limit'))
    passing_score = models.IntegerField(default=60, help_text=_('Passing score in percentage'), verbose_name=_('Passing Score'))
    test_mode = models.CharField(max_length=10, choices=TEST_MODE_CHOICES, default='both', verbose_name=_('Test Mode'), help_text=_('Test qayerda yechiladi'))
    random_questions_count = models.IntegerField(default=0, verbose_name=_('Random Questions Count'), help_text=_('0 = barcha savollar, >0 = shuncha ta random savol tanlanadi'))
    show_answers_immediately = models.BooleanField(default=True, verbose_name=_('Show Answers Immediately'), help_text=_('Har bir savoldan keyin javob ko\'rsatilsinmi'))
    trial_questions_count = models.IntegerField(default=10, verbose_name=_('Trial Questions Count'), help_text=_('Trial test uchun nechta savol berilsin'))
    max_attempts = models.IntegerField(default=2, verbose_name=_('Max Attempts'), help_text=_('Foydalanuvchi necha marta urinish berishi mumkin'))
    is_active = models.BooleanField(default=True, verbose_name=_('Is Active'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Updated at'))

    class Meta:
        verbose_name = _('Test')
        verbose_name_plural = _('Tests')
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Question(models.Model):
    """Question model"""
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='questions', verbose_name=_('Test'))
    text = models.TextField(verbose_name=_('Question Text'))
    order = models.IntegerField(default=0, verbose_name=_('Order'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))

    class Meta:
        verbose_name = _('Question')
        verbose_name_plural = _('Questions')
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.test.title} - {self.text[:50]}"


class AnswerOption(models.Model):
    """Answer option model"""
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options', verbose_name=_('Question'))
    text = models.CharField(max_length=500, verbose_name=_('Answer Text'))
    is_correct = models.BooleanField(default=False, verbose_name=_('Is Correct'))
    order = models.IntegerField(default=0, verbose_name=_('Order'))

    class Meta:
        verbose_name = _('Answer Option')
        verbose_name_plural = _('Answer Options')
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.question.text[:30]} - {self.text[:30]}"


class TestResult(models.Model):
    """Test result model"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='test_results', verbose_name=_('User'))
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='results', verbose_name=_('Test'))
    score = models.IntegerField(verbose_name=_('Score (percentage)'))
    total_questions = models.IntegerField(verbose_name=_('Total Questions'))
    correct_answers = models.IntegerField(verbose_name=_('Correct Answers'))
    started_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Started at'))
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Completed at'))
    time_taken = models.IntegerField(help_text=_('Time taken in seconds'), verbose_name=_('Time Taken'))
    attempt_number = models.IntegerField(default=1, verbose_name=_('Attempt Number'), help_text=_('Qaysi urinish'))
    is_completed = models.BooleanField(default=False, verbose_name=_('Is Completed'), help_text=_('Test yakunlanganmi'))

    class Meta:
        verbose_name = _('Test Result')
        verbose_name_plural = _('Test Results')
        ordering = ['-completed_at']

    def __str__(self):
        return f"{self.user} - {self.test.title} - {self.score}%"

    @property
    def is_passed(self):
        return self.score >= self.test.passing_score


class UserAnswer(models.Model):
    """User answer model"""
    result = models.ForeignKey(TestResult, on_delete=models.CASCADE, related_name='answers', verbose_name=_('Result'))
    question = models.ForeignKey(Question, on_delete=models.CASCADE, verbose_name=_('Question'))
    selected_option = models.ForeignKey(AnswerOption, on_delete=models.CASCADE, verbose_name=_('Selected Option'))
    is_correct = models.BooleanField(verbose_name=_('Is Correct'))

    class Meta:
        verbose_name = _('User Answer')
        verbose_name_plural = _('User Answers')
        unique_together = ['result', 'question']

    def __str__(self):
        return f"{self.result.user} - {self.question.text[:30]}"

