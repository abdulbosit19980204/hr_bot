# Backend .env Faylini Sozlash

## Muammo
`TELEGRAM_BOT_TOKEN` o'rnatilmagan. Notification yuborishda xatolik yuz bermoqda.

## Yechim

### 1. `backend/.env` faylini yarating yoki tahrirlang

`backend` papkasida `.env` faylini yarating va quyidagi sozlamalarni qo'shing:

```env
# Django Settings
SECRET_KEY=django-insecure-change-this-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,unfunereal-matilda-frenular.ngrok-free.dev

# Database (PostgreSQL - optional)
USE_POSTGRES=False

# Telegram Bot Settings
# MUHIM: Quyidagi token'ni o'z bot token'ingiz bilan almashtiring!
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here

# WebApp URL
TELEGRAM_WEBAPP_URL=https://unfunereal-matilda-frenular.ngrok-free.dev

# CORS Settings
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173
```

### 2. Telegram Bot Token olish

1. Telegram'da [@BotFather](https://t.me/BotFather) ga kiring
2. `/newbot` buyrug'ini yuboring
3. Bot nomini kiriting
4. Bot username'ni kiriting (oxirida `bot` bo'lishi kerak, masalan: `my_bot`)
5. BotFather sizga token beradi (masalan: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 3. Token'ni .env fayliga qo'shing

`TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here` qatorini o'z token'ingiz bilan almashtiring:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 4. Django server'ni qayta ishga tushiring

`.env` faylini o'zgartirgandan keyin Django server'ni qayta ishga tushiring:

```bash
# Windows PowerShell
cd backend
python manage.py runserver
```

### 5. Test qiling

Django admin panel'da notification yuborishga harakat qiling. Endi xatolik bo'lmasligi kerak.

## Eslatma

- `.env` faylini git'ga commit qilmang (u `.gitignore` da bo'lishi kerak)
- Token'ni hech kimga ko'rsatmang
- Production'da `SECRET_KEY` ni o'zgartiring

