from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.utils import timezone
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.urls import reverse
import asyncio
from .models import User, CV, Position, TelegramProfile, Notification
from .services import send_notification_to_users


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


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'send_to_all_display', 'recipients_count', 'status_display', 'statistics_display', 'created_at', 'created_by']
    list_filter = ['send_to_all', 'sent_at', 'created_at']
    search_fields = ['title', 'message']
    readonly_fields = ['sent_at', 'created_at', 'updated_at', 'total_recipients', 'successful_sends', 'failed_sends', 'statistics_display']
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
            'fields': ('sent_at', 'total_recipients', 'successful_sends', 'failed_sends', 'statistics_display'),
            'classes': ('collapse',)
        }),
        ('Qo\'shimcha', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
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
        return format_html('<span style="color: orange;">Kutilmoqda</span>')
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
    
    def save_model(self, request, obj, form, change):
        if not change:  # New notification
            obj.created_by = request.user
        
        super().save_model(request, obj, form, change)
        
        # If notification is being sent (has sent_at), don't send again
        if obj.sent_at:
            return
        
        # Send notification
        try:
            # Run async function in sync context
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(send_notification_to_users(obj))
            loop.close()
            
            # Update sent_at
            obj.sent_at = timezone.now()
            obj.save(update_fields=['sent_at', 'total_recipients', 'successful_sends', 'failed_sends'])
            
            messages.success(
                request,
                f"Xabar muvaffaqiyatli yuborildi! "
                f"Jami: {result['total']}, "
                f"Muvaffaqiyatli: {result['successful']}, "
                f"Xatolik: {result['failed']}"
            )
        except Exception as e:
            messages.error(request, f"Xabar yuborishda xatolik yuz berdi: {str(e)}")
    
    def get_readonly_fields(self, request, obj=None):
        readonly = list(super().get_readonly_fields(request, obj))
        if obj and obj.sent_at:  # If already sent, make all fields readonly
            readonly.extend(['title', 'message', 'send_to_all', 'recipients'])
        return readonly
    
    class Media:
        css = {
            'all': ('admin/css/notification_admin.css',)
        }
