from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _


class Position(models.Model):
    """Position model - lavozimlar"""
    name = models.CharField(max_length=255, unique=True, verbose_name=_('Position Name'))
    description = models.TextField(blank=True, null=True, verbose_name=_('Description'))
    is_open = models.BooleanField(default=True, verbose_name=_('Is Open'), help_text=_('Faqat ochiq positionlarga hujjat topshirish mumkin'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Updated at'))

    class Meta:
        verbose_name = _('Position')
        verbose_name_plural = _('Positions')
        ordering = ['name']

    def __str__(self):
        return self.name


class User(AbstractUser):
    """Custom User model - faqat ro'yxatdan o'tish ma'lumotlari"""
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True, verbose_name=_('Telegram ID'), help_text=_('Telegram ID - TelegramProfile bilan bog\'lanish uchun'))
    phone = models.CharField(max_length=20, null=True, blank=True, verbose_name=_('Phone'))
    position = models.ForeignKey('Position', on_delete=models.SET_NULL, null=True, blank=True, related_name='users', verbose_name=_('Position'))
    is_blocked = models.BooleanField(default=False, verbose_name=_('Is Blocked'), help_text=_('User block qilinganmi (cheating yoki boshqa sabablar)'))
    blocked_reason = models.TextField(blank=True, null=True, verbose_name=_('Block Reason'), help_text=_('Block qilinish sababi'))
    blocked_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Blocked At'))
    trial_tests_taken = models.JSONField(default=list, blank=True, verbose_name=_('Trial Tests Taken'), help_text=_('Qaysi testlardan trial test olgan'))
    notification_enabled = models.BooleanField(default=True, verbose_name=_('Notification Enabled'), help_text=_('Telegram orqali bildirishnomalar yoqilganmi'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Updated at'))

    class Meta:
        verbose_name = _('User')
        verbose_name_plural = _('Users')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.first_name} {self.last_name}" if self.first_name or self.last_name else self.username


class TelegramProfile(models.Model):
    """Telegram ma'lumotlari - alohida table"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='telegram_profile', verbose_name=_('User'))
    telegram_id = models.BigIntegerField(unique=True, verbose_name=_('Telegram ID'))
    telegram_first_name = models.CharField(max_length=255, blank=True, null=True, verbose_name=_('Telegram First Name'))
    telegram_last_name = models.CharField(max_length=255, blank=True, null=True, verbose_name=_('Telegram Last Name'))
    telegram_username = models.CharField(max_length=255, null=True, blank=True, verbose_name=_('Telegram Username'))
    telegram_language_code = models.CharField(max_length=10, null=True, blank=True, verbose_name=_('Telegram Language Code'))
    telegram_is_premium = models.BooleanField(default=False, verbose_name=_('Telegram Premium'))
    telegram_is_bot = models.BooleanField(default=False, verbose_name=_('Is Bot'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Updated at'))

    class Meta:
        verbose_name = _('Telegram Profile')
        verbose_name_plural = _('Telegram Profiles')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.telegram_first_name} {self.telegram_last_name}" if self.telegram_first_name or self.telegram_last_name else f"Telegram User {self.telegram_id}"


class CV(models.Model):
    """CV file model"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cvs', verbose_name=_('User'))
    file = models.FileField(upload_to='cvs/%Y/%m/%d/', verbose_name=_('CV File'))
    file_name = models.CharField(max_length=255, verbose_name=_('File Name'))
    file_size = models.IntegerField(verbose_name=_('File Size (bytes)'))
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Uploaded at'))

    class Meta:
        verbose_name = _('CV')
        verbose_name_plural = _('CVs')
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.user} - {self.file_name}"
