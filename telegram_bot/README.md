# Telegram Bot

Telegram bot for HR testing system.

## Setup

### Development Mode (Polling)

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Fill in `.env` with your credentials:
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here

# Backend API URL (development uchun)
API_BASE_URL=http://localhost:8000/api

# WebApp URL (production'da HTTPS bo'lishi kerak)
# Development uchun: http://localhost:5173
# Production uchun: https://yourdomain.com
TELEGRAM_WEBAPP_URL=http://localhost:5173
```

4. Run bot:
```bash
python bot.py
```

### Production Mode (Webhook)

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file with production settings:
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here

# Backend API URL
API_BASE_URL=https://yourdomain.com/api

# WebApp URL (HTTPS bo'lishi kerak)
TELEGRAM_WEBAPP_URL=https://yourdomain.com

# Webhook Configuration
WEBHOOK_HOST=https://yourdomain.com
WEBHOOK_PATH=/webhook
WEBAPP_HOST=0.0.0.0
WEBAPP_PORT=8443
```

3. Run webhook server:
```bash
python webhook.py
```

## Commands

- `/start` - Start bot and register
- `/menu` - Show main menu
- `/results` - Show test results

## Features

- User registration with position selection
- Test selection based on user position
- WebApp integration for test taking
- Test results display
- CV upload

## Webhook Setup

Production uchun webhook o'rnatish:

1. SSL sertifikat o'rnatish (Let's Encrypt)
2. Nginx konfiguratsiyasi
3. Systemd service
4. Webhook URL o'rnatish

Batafsil ma'lumot uchun `DEPLOYMENT.md` faylini ko'ring.

## Troubleshooting

### WebApp URL muammosi

Agar WebApp ochilmasa:
- `.env` faylida `TELEGRAM_WEBAPP_URL` to'g'ri URL bo'lishi kerak
- Production'da HTTPS URL ishlatish kerak
- Development'da HTTP URL ishlatish mumkin (link sifatida)

### Bot ishlamayapti

- Token to'g'ri ekanligini tekshiring
- Backend API ishlayotganini tekshiring
- Loglarni ko'ring: `python bot.py`
