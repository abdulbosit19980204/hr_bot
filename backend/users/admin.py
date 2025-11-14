from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.utils import timezone
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.urls import reverse, path
from django.shortcuts import get_object_or_404, redirect
import asyncio
import logging
from .models import User, CV, Position, TelegramProfile, Notification, NotificationError
from .services import send_notification_to_users

logger = logging.getLogger(__name__)


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_open', 'tests_count', 'created_at']
    list_filter = ['is_open', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    
    def tests_count(self, obj):
        return obj.tests.count()
    tests_count.short_description = 'Tests'


@admin.register(TelegramProfile)
class TelegramProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'telegram_id', 'telegram_first_name', 'telegram_last_name', 'telegram_username', 'telegram_is_premium', 'created_at']
    list_filter = ['telegram_is_premium', 'telegram_is_bot', 'created_at']
    search_fields = ['user__username', 'telegram_id', 'telegram_first_name', 'telegram_last_name', 'telegram_username']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['user']


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'first_name', 'last_name', 'email', 'phone', 'position', 'telegram_id', 'is_blocked', 'is_staff', 'created_at']
    list_filter = ['is_staff', 'is_superuser', 'is_blocked', 'position', 'created_at']
    search_fields = ['username', 'first_name', 'last_name', 'email', 'phone', 'telegram_id']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Additional Info', {'fields': ('telegram_id', 'phone', 'position')}),
        ('Block Status', {'fields': ('is_blocked', 'blocked_reason', 'blocked_at')}),
        ('Trial Tests', {'fields': ('trial_tests_taken',)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {'fields': ('telegram_id', 'phone', 'position')}),
    )
    readonly_fields = ['blocked_at']


@admin.register(CV)
class CVAdmin(admin.ModelAdmin):
    list_display = ['user', 'file_name', 'file_size', 'uploaded_at']
    list_filter = ['uploaded_at']
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'file_name']
    readonly_fields = ['uploaded_at', 'file_size']


@admin.register(NotificationError)
class NotificationErrorAdmin(admin.ModelAdmin):
    list_display = ['notification', 'user', 'telegram_id', 'error_type', 'error_message_short', 'created_at']
    list_filter = ['error_type', 'created_at', 'notification']
    search_fields = ['notification__title', 'user__username', 'user__first_name', 'user__last_name', 'telegram_id', 'error_message']
    readonly_fields = ['notification', 'user', 'telegram_id', 'error_message', 'error_type', 'created_at']
    raw_id_fields = ['notification', 'user']
    
    def error_message_short(self, obj):
        if len(obj.error_message) > 100:
            return obj.error_message[:100] + '...'
        return obj.error_message
    error_message_short.short_description = 'Xatolik xabari'
    
    def has_add_permission(self, request):
        return False  # Xatoliklar faqat avtomatik yaratiladi


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'send_to_all_display', 'recipients_count', 'status_display', 'statistics_display', 'errors_count_display', 'created_at', 'created_by']
    list_filter = ['send_to_all', 'sent_at', 'created_at']
    search_fields = ['title', 'message']
    readonly_fields = ['sent_at', 'created_at', 'updated_at', 'total_recipients', 'successful_sends', 'failed_sends', 'statistics_display', 'errors_link']
    filter_horizontal = ['recipients']
    fieldsets = (
        ('Xabar Ma\'lumotlari', {
            'fields': ('title', 'message')
        }),
        ('Yuborish Sozlamalari', {
            'fields': ('send_to_all', 'recipients'),
            'description': 'Barchaga yuborish yoki tanlangan foydalanuvchilarga yuborish'
        }),
        ('Statistika', {
            'fields': ('sent_at', 'total_recipients', 'successful_sends', 'failed_sends', 'statistics_display', 'errors_link'),
            'classes': ('collapse',)
        }),
        ('Qo\'shimcha', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<int:notification_id>/send/',
                self.admin_site.admin_view(self.send_notification),
                name='users_notification_send',
            ),
        ]
        return custom_urls + urls
    
    def send_notification(self, request, notification_id):
        """Send notification manually"""
        notification = get_object_or_404(Notification, pk=notification_id)
        
        if notification.sent_at:
            messages.warning(request, "Bu xabar allaqachon yuborilgan!")
            return redirect('admin:users_notification_change', notification_id)
        
        try:
            # Run async function in sync context
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(send_notification_to_users(notification))
            loop.close()
            
            # Update sent_at
            notification.sent_at = timezone.now()
            notification.save(update_fields=['sent_at', 'total_recipients', 'successful_sends', 'failed_sends'])
            
            messages.success(
                request,
                f"✅ Xabar muvaffaqiyatli yuborildi!<br/>"
                f"📊 <strong>Jami:</strong> {result['total']}<br/>"
                f"✅ <strong>Muvaffaqiyatli:</strong> {result['successful']}<br/>"
                f"❌ <strong>Xatolik:</strong> {result['failed']}"
            )
            
            if result['failed'] > 0:
                messages.warning(
                    request,
                    f"⚠️ {result['failed']} ta xatolik yuz berdi. "
                    f"Xatoliklarni ko'rish uchun 'Xatoliklar' bo'limiga o'ting."
                )
        except Exception as e:
            messages.error(
                request,
                f"❌ Xabar yuborishda xatolik yuz berdi: {str(e)}"
            )
            logger.error(f"Error sending notification {notification_id}: {e}", exc_info=True)
        
        return redirect('admin:users_notification_change', notification_id)
    
    def send_to_all_display(self, obj):
        if obj.send_to_all:
            return format_html('<span style="color: green;">✓ Barchaga</span>')
        return format_html('<span style="color: blue;">Tanlanganlarga</span>')
    send_to_all_display.short_description = 'Yuborish turi'
    
    def recipients_count(self, obj):
        if obj.send_to_all:
            from .models import User
            count = User.objects.filter(telegram_id__isnull=False, notification_enabled=True, is_active=True).exclude(telegram_id=0).count()
            return f"Barcha ({count})"
        return f"{obj.recipients.count()} ta"
    recipients_count.short_description = 'Qabul qiluvchilar'
    
    def status_display(self, obj):
        if obj.sent_at:
            return format_html('<span style="color: green;">✓ Yuborilgan</span>')
        return format_html('<span style="color: orange;">⏳ Kutilmoqda</span>')
    status_display.short_description = 'Holat'
    
    def statistics_display(self, obj):
        if obj.sent_at:
            return format_html(
                '<div style="padding: 5px;">'
                '<strong>Jami:</strong> {}<br/>'
                '<span style="color: green;"><strong>Muvaffaqiyatli:</strong> {}</span><br/>'
                '<span style="color: red;"><strong>Xatolik:</strong> {}</span>'
                '</div>',
                obj.total_recipients or 0,
                obj.successful_sends or 0,
                obj.failed_sends or 0
            )
        return "Hali yuborilmagan"
    statistics_display.short_description = 'Statistika'
    
    def errors_count_display(self, obj):
        if obj.sent_at:
            errors_count = obj.errors.count()
            if errors_count > 0:
                return format_html(
                    '<a href="{}" style="color: red; font-weight: bold;">{} ta xatolik</a>',
                    reverse('admin:users_notificationerror_changelist') + f'?notification__id__exact={obj.id}',
                    errors_count
                )
            return format_html('<span style="color: green;">Xatoliklar yo\'q</span>')
        return "-"
    errors_count_display.short_description = 'Xatoliklar'
    
    def errors_link(self, obj):
        if obj and obj.sent_at:
            errors_count = obj.errors.count()
            if errors_count > 0:
                return format_html(
                    '<a href="{}" class="button" style="background: #ba2121; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">'
                    '❌ {} ta xatolikni ko\'rish</a>',
                    reverse('admin:users_notificationerror_changelist') + f'?notification__id__exact={obj.id}',
                    errors_count
                )
            return format_html('<span style="color: green;">✅ Xatoliklar yo\'q</span>')
        return "Xabar hali yuborilmagan"
    errors_link.short_description = 'Xatoliklar ro\'yxati'
    
    def save_model(self, request, obj, form, change):
        if not change:  # New notification
            obj.created_by = request.user
        
        super().save_model(request, obj, form, change)
        
        # Don't send automatically - user must click "Send" button
        # Removed automatic sending code
    
    def response_change(self, request, obj):
        """Add 'Send' button to change form"""
        if "_send" in request.POST:
            return redirect('admin:users_notification_send', obj.pk)
        return super().response_change(request, obj)
    
    def changeform_view(self, request, object_id=None, form_url='', extra_context=None):
        extra_context = extra_context or {}
        if object_id:
            try:
                notification = Notification.objects.get(pk=object_id)
                if not notification.sent_at:
                    extra_context['show_send_button'] = True
            except Notification.DoesNotExist:
                pass
        return super().changeform_view(request, object_id, form_url, extra_context)
    
    def get_readonly_fields(self, request, obj=None):
        readonly = list(super().get_readonly_fields(request, obj))
        if obj and obj.sent_at:  # If already sent, make all fields readonly
            readonly.extend(['title', 'message', 'send_to_all', 'recipients'])
        return readonly
    
    class Media:
        css = {
            'all': ('admin/css/notification_admin.css',)
        }
        js = ('admin/js/notification_admin.js',)
