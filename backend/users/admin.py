from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, CV, Position


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_open', 'tests_count', 'created_at']
    list_filter = ['is_open', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    
    def tests_count(self, obj):
        return obj.tests.count()
    tests_count.short_description = 'Tests'


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

