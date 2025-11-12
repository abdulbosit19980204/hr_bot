# 🚀 HR Bot - Production Deployment Guide

Bu dokumentatsiya HR Bot loyihasini production muhitiga deploy qilish uchun to'liq qo'llanma.

## 📋 Mundarija

1. [Server Talablari](#server-talablari)
2. [Domen va SSL Sertifikat](#domen-va-ssl-sertifikat)
3. [Server O'rnatish](#server-ornatish)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Backend Deployment](#backend-deployment)
7. [Telegram Bot Webhook Setup](#telegram-bot-webhook-setup)
8. [WebApp Deployment](#webapp-deployment)
9. [Nginx Configuration](#nginx-configuration)
10. [SSL/HTTPS Setup](#sslhttps-setup)
11. [Monitoring va Logging](#monitoring-va-logging)
12. [Backup Strategiyasi](#backup-strategiyasi)
13. [Troubleshooting](#troubleshooting)

---

## 🖥️ Server Talablari

### Minimal Talablar

- **CPU**: 2 core
- **RAM**: 4 GB
- **Disk**: 20 GB SSD
- **OS**: Ubuntu 20.04 LTS yoki 22.04 LTS
- **Network**: Statik IP manzil

### Tavsiya Etilgan

- **CPU**: 4 core
- **RAM**: 8 GB
- **Disk**: 50 GB SSD
- **OS**: Ubuntu 22.04 LTS
- **Network**: Statik IP manzil

### Kerakli Dasturlar

```bash
# Ubuntu/Debian uchun
sudo apt update
sudo apt upgrade -y

# Docker va Docker Compose
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# Git
sudo apt install -y git

# Nginx (agar Docker ishlatmasangiz)
sudo apt install -y nginx

# Certbot (SSL sertifikatlar uchun)
sudo apt install -y certbot python3-certbot-nginx
```

---

## 🌐 Domen va SSL Sertifikat

### 1. Domen Xarid Qilish

- Domen xarid qiling (masalan: `yourdomain.com`)
- DNS sozlamalarini o'rnating:
  - **A Record**: `@` → Server IP manzili
  - **A Record**: `www` → Server IP manzili
  - **A Record**: `api` → Server IP manzili (ixtiyoriy)
  - **A Record**: `webapp` → Server IP manzili (ixtiyoriy)

### 2. DNS Sozlamalarini Tekshirish

```bash
# DNS propagatsiyasini tekshirish
nslookup yourdomain.com
dig yourdomain.com
```

DNS propagatsiyasi 24-48 soat davom etishi mumkin.

---

## 🛠️ Server O'rnatish

### 1. Serverga Ulanish

```bash
ssh root@your-server-ip
# yoki
ssh username@your-server-ip
```

### 2. Loyihani Klon Qilish

```bash
# Kerakli papkaga o'ting
cd /opt  # yoki /var/www yoki boshqa joy

# Git repository'ni klon qiling
git clone https://github.com/yourusername/hr_bot.git
cd hr_bot
```

### 3. Loyiha Strukturasi

```
hr_bot/
├── backend/          # Django backend
├── telegram_bot/     # Telegram bot
├── webapp/           # Telegram WebApp (React)
├── dashboard/        # Dashboard (React)
├── nginx/            # Nginx konfiguratsiyasi
└── docker-compose.yml
```

---

## ⚙️ Environment Variables

### Backend Environment Variables

`backend/.env` faylini yarating:

```bash
cd backend
nano .env
```

```env
# Django Settings
SECRET_KEY=your-super-secret-key-here-generate-with-openssl-rand-hex-32
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,api.yourdomain.com

# Database (PostgreSQL)
USE_POSTGRES=True
DB_NAME=hr_bot_db
DB_USER=hr_bot_user
DB_PASSWORD=your-strong-database-password-here
DB_HOST=db
DB_PORT=5432

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-from-botfather
TELEGRAM_WEBAPP_URL=https://yourdomain.com/webapp

# CORS Settings
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://web.telegram.org

# Security
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

**SECRET_KEY yaratish:**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Telegram Bot Environment Variables

`telegram_bot/.env` faylini yarating:

```bash
cd telegram_bot
nano .env
```

```env
# Telegram Bot Token
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-from-botfather

# Backend API URL
API_BASE_URL=https://yourdomain.com/api

# WebApp URL
TELEGRAM_WEBAPP_URL=https://yourdomain.com/webapp

# Admin Chat ID (ixtiyoriy - xatoliklar uchun)
ADMIN_CHAT_ID=your-admin-telegram-chat-id

# Webhook Settings (Production uchun)
WEBHOOK_HOST=https://yourdomain.com
WEBHOOK_PATH=/webhook
WEBAPP_HOST=0.0.0.0
WEBAPP_PORT=8443

# Redis (ixtiyoriy - state storage uchun)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

### WebApp Environment Variables

`webapp/.env` faylini yarating:

```bash
cd webapp
nano .env
```

```env
VITE_API_BASE_URL=https://yourdomain.com/api
VITE_TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

### Dashboard Environment Variables

`dashboard/.env` faylini yarating:

```bash
cd dashboard
nano .env
```

```env
VITE_API_BASE_URL=https://yourdomain.com/api
```

### Docker Compose Environment

Asosiy `docker-compose.yml` faylida environment variable'lar to'g'ri sozlanganligini tekshiring.

---

## 🗄️ Database Setup

### PostgreSQL Docker Container

Docker Compose orqali PostgreSQL avtomatik o'rnatiladi. Agar alohida PostgreSQL kerak bo'lsa:

```bash
# PostgreSQL o'rnatish
sudo apt install -y postgresql postgresql-contrib

# PostgreSQL'ga kirish
sudo -u postgres psql

# Database va user yaratish
CREATE DATABASE hr_bot_db;
CREATE USER hr_bot_user WITH PASSWORD 'your-strong-password';
ALTER ROLE hr_bot_user SET client_encoding TO 'utf8';
ALTER ROLE hr_bot_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE hr_bot_user SET timezone TO 'Asia/Tashkent';
GRANT ALL PRIVILEGES ON DATABASE hr_bot_db TO hr_bot_user;
\q
```

---

## 🔧 Backend Deployment

### 1. Docker Compose orqali (Tavsiya Etiladi)

```bash
cd /opt/hr_bot  # yoki loyiha joylashgan papka

# Docker Compose orqali ishga tushirish
docker-compose up -d

# Loglarni ko'rish
docker-compose logs -f backend

# Migratsiyalarni bajarish
docker-compose exec backend python manage.py migrate

# Superuser yaratish
docker-compose exec backend python manage.py createsuperuser

# Static fayllarni yig'ish
docker-compose exec backend python manage.py collectstatic --noinput
```

### 2. Manual Deployment (Docker bo'lmagan)

```bash
cd backend

# Virtual environment yaratish
python3 -m venv venv
source venv/bin/activate

# Dependencies o'rnatish
pip install -r requirements.txt

# Migratsiyalar
python manage.py migrate

# Superuser
python manage.py createsuperuser

# Static files
python manage.py collectstatic --noinput

# Gunicorn orqali ishga tushirish (Production uchun)
pip install gunicorn
gunicorn hr_bot.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

### 3. Systemd Service (Production uchun)

`/etc/systemd/system/hr-bot-backend.service` faylini yarating:

```ini
[Unit]
Description=HR Bot Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/hr_bot/backend
Environment="PATH=/opt/hr_bot/backend/venv/bin"
ExecStart=/opt/hr_bot/backend/venv/bin/gunicorn hr_bot.wsgi:application --bind 127.0.0.1:8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Service'ni ishga tushirish
sudo systemctl daemon-reload
sudo systemctl enable hr-bot-backend
sudo systemctl start hr-bot-backend
sudo systemctl status hr-bot-backend
```

---

## 🤖 Telegram Bot Webhook Setup

### 1. Webhook Server O'rnatish

Telegram Bot uchun webhook server ishga tushirish kerak. Ikki usul bor:

#### Usul 1: webhook.py orqali (Tavsiya Etiladi)

```bash
cd telegram_bot

# Virtual environment
python3 -m venv venv
source venv/bin/activate

# Dependencies
pip install -r requirements.txt

# Webhook server ishga tushirish
python webhook.py
```

#### Usul 2: Systemd Service

`/etc/systemd/system/hr-bot-telegram.service` faylini yarating:

```ini
[Unit]
Description=HR Bot Telegram Webhook
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/hr_bot/telegram_bot
Environment="PATH=/opt/hr_bot/telegram_bot/venv/bin"
ExecStart=/opt/hr_bot/telegram_bot/venv/bin/python webhook.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable hr-bot-telegram
sudo systemctl start hr-bot-telegram
sudo systemctl status hr-bot-telegram
```

### 2. SSL Sertifikat (Webhook uchun)

Telegram webhook HTTPS talab qiladi. SSL sertifikat o'rnatilgandan keyin webhook ishlaydi.

### 3. Webhook URL Sozlash

Webhook avtomatik sozlanadi (webhook.py ichida). Agar manual sozlash kerak bo'lsa:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://yourdomain.com/webhook"
```

### 4. Webhook Tekshirish

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### 5. Polling Mode (Development uchun)

Agar webhook ishlamasa, polling mode ishlatish mumkin:

```bash
cd telegram_bot
python bot.py  # Polling mode
```

**Production'da webhook tavsiya etiladi!**

---

## 🌐 WebApp Deployment

### 1. Build Qilish

```bash
cd webapp

# Dependencies o'rnatish
npm install

# Production build
npm run build
```

Build qilingan fayllar `webapp/dist/` papkasida bo'ladi.

### 2. Nginx orqali Serve Qilish

Nginx konfiguratsiyasida WebApp avtomatik serve qilinadi (quyida).

### 3. Docker orqali

Docker Compose orqali avtomatik ishga tushadi:

```bash
docker-compose up -d webapp
```

### 4. Manual Serve (Development)

```bash
cd webapp
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## 🔒 Nginx Configuration

### 1. Nginx Konfiguratsiyasi

`nginx/nginx.conf` faylini yangilang:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/hr_bot_access.log;
    error_log /var/log/nginx/hr_bot_error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    upstream backend {
        server 127.0.0.1:8000;  # Backend server
    }

    upstream webapp {
        server 127.0.0.1:5173;  # WebApp server
    }

    upstream dashboard {
        server 127.0.0.1:3000;  # Dashboard server
    }

    # HTTP -> HTTPS redirect
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        
        # Let's Encrypt verification
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        # Redirect to HTTPS
        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS Server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL Certificates
        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
        
        # SSL Configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security Headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Backend API
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Admin Panel
        location /admin/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static Files
        location /static/ {
            alias /opt/hr_bot/backend/staticfiles/;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        # Media Files
        location /media/ {
            alias /opt/hr_bot/backend/media/;
            expires 7d;
            add_header Cache-Control "public";
        }

        # WebApp
        location /webapp/ {
            proxy_pass http://webapp/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # Dashboard
        location /dashboard/ {
            proxy_pass http://dashboard/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # Telegram Webhook
        location /webhook {
            proxy_pass http://127.0.0.1:8443;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Root
        location / {
            proxy_pass http://webapp/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 2. Nginx'ni Ishga Tushirish

```bash
# Konfiguratsiyani tekshirish
sudo nginx -t

# Nginx'ni qayta ishga tushirish
sudo systemctl restart nginx

# Status tekshirish
sudo systemctl status nginx
```

### 3. Docker orqali Nginx

Agar Docker ishlatilsa:

```bash
docker-compose up -d nginx
```

---

## 🔐 SSL/HTTPS Setup

### Let's Encrypt orqali (Tavsiya Etiladi)

```bash
# Certbot o'rnatish
sudo apt install -y certbot python3-certbot-nginx

# SSL sertifikat olish
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Avtomatik yangilanish
sudo certbot renew --dry-run
```

### Avtomatik Yangilanish

```bash
# Crontab'ga qo'shish
sudo crontab -e

# Quyidagini qo'shing:
0 0 * * * certbot renew --quiet && systemctl reload nginx
```

### Manual SSL Sertifikat

Agar boshqa provider'dan SSL sertifikat bo'lsa:

```bash
# Sertifikatlarni nginx papkasiga ko'chirish
sudo mkdir -p /etc/nginx/ssl
sudo cp your-cert.pem /etc/nginx/ssl/
sudo cp your-key.pem /etc/nginx/ssl/

# Nginx konfiguratsiyasida path'ni yangilang
```

---

## 📊 Monitoring va Logging

### 1. Loglarni Ko'rish

```bash
# Backend loglari
tail -f /opt/hr_bot/backend/logs/hr_bot.log

# Telegram bot loglari
tail -f /opt/hr_bot/telegram_bot/logs/telegram_bot.log

# Nginx loglari
tail -f /var/log/nginx/hr_bot_access.log
tail -f /var/log/nginx/hr_bot_error.log

# Docker loglari
docker-compose logs -f
```

### 2. System Monitoring

```bash
# CPU va Memory
htop

# Disk foydalanish
df -h

# Network
netstat -tulpn
```

### 3. Application Monitoring

- **Uptime monitoring**: UptimeRobot, Pingdom
- **Error tracking**: Sentry (ixtiyoriy)
- **Analytics**: Google Analytics (ixtiyoriy)

---

## 💾 Backup Strategiyasi

### 1. Database Backup

```bash
# PostgreSQL backup script
#!/bin/bash
BACKUP_DIR="/opt/backups/hr_bot"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Database backup
docker-compose exec -T db pg_dump -U hr_bot_user hr_bot_db > $BACKUP_DIR/db_$DATE.sql

# Media files backup
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /opt/hr_bot/backend/media/

# Eski backup'larni o'chirish (30 kundan eski)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

### 2. Avtomatik Backup

```bash
# Crontab'ga qo'shish
sudo crontab -e

# Har kuni ertalab 2:00 da backup
0 2 * * * /opt/hr_bot/scripts/backup.sh
```

### 3. Backup Restore

```bash
# Database restore
docker-compose exec -T db psql -U hr_bot_user hr_bot_db < /opt/backups/hr_bot/db_20240101_120000.sql

# Media restore
tar -xzf /opt/backups/hr_bot/media_20240101_120000.tar.gz -C /
```

---

## 🔧 Troubleshooting

### Backend Ishlamayapti

```bash
# Loglarni tekshirish
docker-compose logs backend
# yoki
tail -f /opt/hr_bot/backend/logs/hr_bot.log

# Database ulanishini tekshirish
docker-compose exec backend python manage.py dbshell

# Migratsiyalarni tekshirish
docker-compose exec backend python manage.py showmigrations
```

### Telegram Bot Ishlamayapti

```bash
# Webhook tekshirish
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Loglarni tekshirish
tail -f /opt/hr_bot/telegram_bot/logs/telegram_bot.log

# Webhook'ni qayta sozlash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://yourdomain.com/webhook"
```

### Nginx Xatolari

```bash
# Konfiguratsiyani tekshirish
sudo nginx -t

# Error loglarni ko'rish
sudo tail -f /var/log/nginx/hr_bot_error.log

# Nginx'ni qayta ishga tushirish
sudo systemctl restart nginx
```

### SSL Sertifikat Muammolari

```bash
# Sertifikatni tekshirish
sudo certbot certificates

# Sertifikatni yangilash
sudo certbot renew

# Nginx'ni qayta yuklash
sudo systemctl reload nginx
```

### Port Muammolari

```bash
# Port'larni tekshirish
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
sudo netstat -tulpn | grep :8000

# Firewall sozlamalari
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

---

## ✅ Deployment Checklist

### Pre-Deployment

- [ ] Server talablari tekshirildi
- [ ] Domen xarid qilindi va DNS sozlandi
- [ ] SSL sertifikat olingan
- [ ] Environment variable'lar to'ldirildi
- [ ] Database sozlandi
- [ ] Firewall sozlandi

### Deployment

- [ ] Backend deploy qilindi va ishlamoqda
- [ ] Telegram bot webhook sozlandi
- [ ] WebApp build qilindi va deploy qilindi
- [ ] Nginx sozlandi va ishlamoqda
- [ ] SSL sertifikat o'rnatildi
- [ ] Static va media fayllar to'g'ri serve qilinmoqda

### Post-Deployment

- [ ] Barcha servislar ishlamoqda
- [ ] Telegram bot javob bermoqda
- [ ] WebApp ochilmoqda
- [ ] API ishlamoqda
- [ ] Admin panel ishlamoqda
- [ ] Backup strategiyasi sozlandi
- [ ] Monitoring sozlandi

---

## 📞 Qo'llab-Quvvatlash

Muammo bo'lsa:

1. Loglarni tekshiring
2. Dokumentatsiyani qayta o'qib chiqing
3. GitHub Issues'da muammo yarating
4. Admin bilan bog'laning

---

## 🔄 Yangilanishlar

### Kod Yangilash

```bash
# Git'dan yangi versiyani olish
cd /opt/hr_bot
git pull origin main

# Docker Compose orqali qayta build
docker-compose build
docker-compose up -d

# Migratsiyalar
docker-compose exec backend python manage.py migrate

# Static files
docker-compose exec backend python manage.py collectstatic --noinput
```

### Dependencies Yangilash

```bash
# Backend
cd backend
pip install -r requirements.txt --upgrade

# WebApp
cd webapp
npm update

# Dashboard
cd dashboard
npm update
```

---

## 📝 Qo'shimcha Eslatmalar

1. **Production'da DEBUG=False bo'lishi kerak**
2. **SECRET_KEY xavfsiz bo'lishi kerak**
3. **Database parollari kuchli bo'lishi kerak**
4. **SSL sertifikatlar muntazam yangilanib turilishi kerak**
5. **Backup'lar muntazam olinib turilishi kerak**
6. **Loglarni muntazam tozalash kerak**
7. **Security update'larni muntazam qilish kerak**

---

## 🎉 Muvaffaqiyatli Deployment!

Agar barcha qadamlarni to'g'ri bajardingiz, loyiha production'da ishlamoqda!

**Test Qilish:**
- Telegram bot: `/start` buyrug'ini yuboring
- WebApp: `https://yourdomain.com/webapp`
- API: `https://yourdomain.com/api/tests/`
- Admin: `https://yourdomain.com/admin/`

**Xayrli ishlatish! 🚀**

