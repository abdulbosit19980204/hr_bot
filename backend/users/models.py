from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    """Custom User model with Telegram integration"""
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True, verbose_name=_('Telegram ID'))
    phone = models.CharField(max_length=20, null=True, blank=True, verbose_name=_('Phone'))
    position = models.CharField(max_length=255, null=True, blank=True, verbose_name=_('Position'))
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

