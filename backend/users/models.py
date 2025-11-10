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
    """Custom User model with Telegram integration"""
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True, verbose_name=_('Telegram ID'))
    phone = models.CharField(max_length=20, null=True, blank=True, verbose_name=_('Phone'))
    position = models.ForeignKey('Position', on_delete=models.SET_NULL, null=True, blank=True, related_name='users', verbose_name=_('Position'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Updated at'))

    class Meta:
        verbose_name = _('User')
        verbose_name_plural = _('Users')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.first_name} {self.last_name}" if self.first_name or self.last_name else self.username


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
