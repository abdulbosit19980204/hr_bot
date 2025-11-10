"""
ASGI config for hr_bot project.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hr_bot.settings')

application = get_asgi_application()

