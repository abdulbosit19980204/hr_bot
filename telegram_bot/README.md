# Telegram Bot

Telegram bot for HR testing system.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Fill in `.env` with your credentials:
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token from @BotFather
- `API_BASE_URL` - Backend API URL
- `TELEGRAM_WEBAPP_URL` - WebApp URL

4. Run bot:
```bash
python bot.py
```

## Commands

- `/start` - Start bot and register
- `/menu` - Show main menu
- `/results` - Show test results

