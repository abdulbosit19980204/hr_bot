# 🚀 Quick Start - Production Deployment

## SSH orqali server'ga ulanish

```bash
ssh e-catalog@192.168.0.28
# Password: Baccardi2020
```

## Deployment

```bash
# 1. Project directory'ga o'tish
cd /home/e-catalog

# 2. Git'dan clone qilish (yoki update)
git clone https://github.com/abdulbosit19980204/hr_bot.git
# yoki
cd hr_bot && git pull origin main

# 3. Deployment script'ni ishga tushirish
cd hr_bot
chmod +x deployment/deploy.sh
./deployment/deploy.sh
```

## Environment Variables sozlash

### Backend
```bash
nano /home/e-catalog/hr_bot/backend/.env
```

### Telegram Bot
```bash
nano /home/e-catalog/hr_bot/telegram_bot/.env
```

## PostgreSQL Database yaratish

```bash
sudo -u postgres psql
CREATE DATABASE hr_bot_db;
CREATE USER hr_bot_user WITH PASSWORD 'KuchliParol123!';
GRANT ALL PRIVILEGES ON DATABASE hr_bot_db TO hr_bot_user;
\q
```

## Services'larni ishga tushirish

```bash
# Backend
sudo systemctl start hr-bot-backend
sudo systemctl enable hr-bot-backend

# Telegram Bot
sudo systemctl start hr-bot-telegram
sudo systemctl enable hr-bot-telegram

# Nginx
sudo systemctl reload nginx
```

## Tekshirish

```bash
# Status
sudo systemctl status hr-bot-backend
sudo systemctl status hr-bot-telegram

# Logs
sudo journalctl -u hr-bot-backend -f
sudo journalctl -u hr-bot-telegram -f
```

## URL

- **Production:** http://178.218.200.120:8523
- **API:** http://178.218.200.120:8523/api/
- **Admin:** http://178.218.200.120:8523/admin/
- **Ngrok WebApp (HTTPS):** https://unfunereal-matilda-frenular.ngrok-free.dev/webapp

---

Batafsil ma'lumot uchun `DEPLOYMENT_INSTRUCTIONS.md` faylini ko'ring.

