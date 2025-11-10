from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, CV


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'first_name', 'last_name', 'email', 'phone', 'position', 'telegram_id', 'is_staff', 'created_at']
    list_filter = ['is_staff', 'is_superuser', 'created_at']
    search_fields = ['username', 'first_name', 'last_name', 'email', 'phone', 'telegram_id']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Additional Info', {'fields': ('telegram_id', 'phone', 'position')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {'fields': ('telegram_id', 'phone', 'position')}),
    )


@admin.register(CV)
class CVAdmin(admin.ModelAdmin):
    list_display = ['user', 'file_name', 'file_size', 'uploaded_at']
    list_filter = ['uploaded_at']
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'file_name']
    readonly_fields = ['uploaded_at', 'file_size']

