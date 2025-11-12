# 🚀 HR Bot Production Deployment Qo'llanmasi

Bu qo'llanma HR Bot loyihasini production server'ga deploy qilish uchun step-by-step ko'rsatmalar.

## 📋 Server Ma'lumotlari

- **SSH Host:** 192.168.0.28
- **SSH User:** e-catalog
- **SSH Password:** Baccardi2020
- **Production URL:** http://178.218.200.120:8523
- **Port:** 8523

## 🔧 Talablar

Server'da quyidagilar o'rnatilgan bo'lishi kerak:
- Python 3.11+
- Node.js 18+ (WebApp va Dashboard uchun)
- PostgreSQL 15+
- Nginx
- Git

## 📝 Deployment Qadamlari

### 1. Server'ga SSH orqali ulanish

Windows PowerShell yoki CMD'dan:

```powershell
ssh e-catalog@192.168.0.28
```

Parol: `Baccardi2020`

### 2. Server'da kerakli dasturlarni o'rnatish

```bash
# System update
sudo apt update
sudo apt upgrade -y

# Python va pip
sudo apt install -y python3 python3-pip python3-venv

# Node.js va npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Git
sudo apt install -y git

# Nginx
sudo apt install -y nginx
```

### 3. PostgreSQL Database yaratish

```bash
# PostgreSQL'ga kirish
sudo -u postgres psql

# Database va user yaratish
CREATE DATABASE hr_bot_db;
CREATE USER hr_bot_user WITH PASSWORD 'KuchliParol123!';
ALTER ROLE hr_bot_user SET client_encoding TO 'utf8';
ALTER ROLE hr_bot_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE hr_bot_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE hr_bot_db TO hr_bot_user;
\q
```

### 4. Deployment Script'ni ishga tushirish

```bash
# Project directory'ga o'tish
cd /home/e-catalog

# Git'dan clone qilish (agar hali clone qilinmagan bo'lsa)
git clone https://github.com/abdulbosit19980204/hr_bot.git

# Project directory'ga o'tish
cd hr_bot

# Deployment script'ni executable qilish
chmod +x deployment/deploy.sh

# Script'ni ishga tushirish
./deployment/deploy.sh
```

### 5. Environment Variables'ni sozlash

#### Backend `.env` faylini tahrirlash:

```bash
nano /home/e-catalog/hr_bot/backend/.env
```

Quyidagilarni to'ldiring:

```env
DEBUG=False
SECRET_KEY=<Django secret key (deploy.sh tomonidan yaratilgan)>
ALLOWED_HOSTS=178.218.200.120,localhost,127.0.0.1,unfunereal-matilda-frenular.ngrok-free.dev
USE_POSTGRES=True
DB_NAME=hr_bot_db
DB_USER=hr_bot_user
DB_PASSWORD=KuchliParol123!
DB_HOST=localhost
DB_PORT=5432
TELEGRAM_BOT_TOKEN=<BotFather'dan olingan token>
TELEGRAM_WEBAPP_URL=https://unfunereal-matilda-frenular.ngrok-free.dev/webapp
CORS_ALLOWED_ORIGINS=https://unfunereal-matilda-frenular.ngrok-free.dev,http://178.218.200.120:8523
```

#### Telegram Bot `.env` faylini tahrirlash:

```bash
nano /home/e-catalog/hr_bot/telegram_bot/.env
```

Quyidagilarni to'ldiring:

```env
TELEGRAM_BOT_TOKEN=<BotFather'dan olingan token>
API_BASE_URL=http://127.0.0.1:8000/api
TELEGRAM_WEBAPP_URL=https://unfunereal-matilda-frenular.ngrok-free.dev/webapp
ADMIN_CHAT_ID=<Admin Telegram Chat ID>
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

**Eslatma:** Agar Redis ishlatmasangiz, telegram bot MemoryStorage ishlatadi.

#### WebApp `.env` faylini tahrirlash (agar kerak bo'lsa):

```bash
nano /home/e-catalog/hr_bot/webapp/.env
```

Quyidagilarni to'ldiring:

```env
# Backend API Base URL (ngrok orqali)
VITE_API_BASE_URL=https://unfunereal-matilda-frenular.ngrok-free.dev/api
```

**Eslatma:** WebApp build qilinganda, bu environment variable build'ga kiritiladi. Agar o'zgarish kiritilsa, qayta build qilish kerak.

### 6. Ngrok sozlash (ixtiyoriy - agar webapp'ni ngrok orqali serve qilmoqchi bo'lsangiz)

Agar webapp'ni ngrok orqali HTTPS'da ishga tushirmoqchi bo'lsangiz:

1. **Ngrok o'rnatish:**
```bash
# Ngrok'ni yuklab olish
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Yoki manual yuklab olish
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

2. **Ngrok authtoken sozlash:**
```bash
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

3. **Ngrok tunnel ishga tushirish:**
```bash
# WebApp uchun (port 5173 yoki build qilingan fayllar uchun)
ngrok http 5173

# Yoki backend API uchun (port 8000)
ngrok http 8000

# Yoki ikkalasini ham (2 ta terminal'da)
```

4. **Ngrok URL'ni olish:**
Ngrok ishga tushgandan keyin, terminal'da ko'rsatilgan URL'ni oling (masalan: `https://unfunereal-matilda-frenular.ngrok-free.dev`)

5. **Ngrok'ni systemd service sifatida ishga tushirish (ixtiyoriy):**

```bash
sudo nano /etc/systemd/system/ngrok.service
```

Quyidagilarni qo'shing:

```ini
[Unit]
Description=Ngrok tunnel
After=network.target

[Service]
Type=simple
User=e-catalog
ExecStart=/usr/local/bin/ngrok http 5173
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Keyin:
```bash
sudo systemctl enable ngrok
sudo systemctl start ngrok
```

**Muhim:** Ngrok free tier'da URL har safar o'zgaradi. Agar doimiy URL kerak bo'lsa, ngrok paid plan yoki boshqa tunnel xizmatidan foydalaning.

### 7. Django Superuser yaratish

```bash
cd /home/e-catalog/hr_bot/backend
source venv/bin/activate
python manage.py createsuperuser
```

### 8. Services'larni ishga tushirish

```bash
# Backend service'ni ishga tushirish
sudo systemctl start hr-bot-backend

# Telegram bot service'ni ishga tushirish
sudo systemctl start hr-bot-telegram

# Nginx'ni reload qilish
sudo systemctl reload nginx
```

### 9. Services'larni tekshirish

```bash
# Backend status
sudo systemctl status hr-bot-backend

# Telegram bot status
sudo systemctl status hr-bot-telegram

# Nginx status
sudo systemctl status nginx
```

## 🔍 Loglarni ko'rish

### Backend logs:

```bash
# Systemd logs
sudo journalctl -u hr-bot-backend -f

# Gunicorn error logs
tail -f /var/log/hr_bot/gunicorn_error.log

# Gunicorn access logs
tail -f /var/log/hr_bot/gunicorn_access.log
```

### Telegram Bot logs:

```bash
# Systemd logs
sudo journalctl -u hr-bot-telegram -f

# Bot log file
tail -f /home/e-catalog/hr_bot/telegram_bot/logs/telegram_bot.log
```

### Nginx logs:

```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log
```

## 🔄 Service'larni boshqarish

### Service'larni to'xtatish:

```bash
sudo systemctl stop hr-bot-backend
sudo systemctl stop hr-bot-telegram
```

### Service'larni qayta ishga tushirish:

```bash
sudo systemctl restart hr-bot-backend
sudo systemctl restart hr-bot-telegram
sudo systemctl reload nginx
```

### Service'larni avtomatik ishga tushirish (boot'da):

```bash
sudo systemctl enable hr-bot-backend
sudo systemctl enable hr-bot-telegram
sudo systemctl enable nginx
```

## 🔄 Update qilish

Loyihani yangilash uchun:

```bash
cd /home/e-catalog/hr_bot

# Git'dan yangi o'zgarishlarni olish
git pull origin main

# Backend dependencies yangilash
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Migrations
python manage.py migrate

# Static files
python manage.py collectstatic --noinput

# WebApp va Dashboard build qilish (agar o'zgarishlar bo'lsa)
cd ../webapp
npm run build

cd ../dashboard
npm run build

# Services'larni restart qilish
sudo systemctl restart hr-bot-backend
sudo systemctl restart hr-bot-telegram
sudo systemctl reload nginx
```

## 🌐 URL'lar

### Production Server:
- **API:** http://178.218.200.120:8523/api/
- **Admin Panel:** http://178.218.200.120:8523/admin/
- **WebApp:** http://178.218.200.120:8523/webapp/
- **Dashboard:** http://178.218.200.120:8523/dashboard/
- **Health Check:** http://178.218.200.120:8523/health/

### Ngrok HTTPS (Agar sozlangan bo'lsa):
- **WebApp:** https://unfunereal-matilda-frenular.ngrok-free.dev/webapp
- **API:** https://unfunereal-matilda-frenular.ngrok-free.dev/api (agar backend ham ngrok orqali serve qilingan bo'lsa)

## 🔒 Xavfsizlik

1. **Firewall sozlash:**

```bash
# UFW o'rnatish va sozlash
sudo apt install ufw
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 8523/tcp  # HTTP
sudo ufw enable
```

2. **SSL/HTTPS sozlash (ixtiyoriy):**

Let's Encrypt orqali SSL sertifikat olish:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 🐛 Troubleshooting

### Backend ishlamayapti:

1. Loglarni tekshiring:
```bash
sudo journalctl -u hr-bot-backend -n 50
```

2. Gunicorn process'ni tekshiring:
```bash
ps aux | grep gunicorn
```

3. Port 8000 bandligini tekshiring:
```bash
sudo netstat -tlnp | grep 8000
```

### Telegram Bot ishlamayapti:

1. Loglarni tekshiring:
```bash
sudo journalctl -u hr-bot-telegram -n 50
```

2. Bot token to'g'riligini tekshiring
3. API_BASE_URL to'g'ri sozlanganligini tekshiring

### Nginx ishlamayapti:

1. Nginx config'ni tekshiring:
```bash
sudo nginx -t
```

2. Nginx loglarni tekshiring:
```bash
tail -f /var/log/nginx/error.log
```

3. Port 8523 bandligini tekshiring:
```bash
sudo netstat -tlnp | grep 8523
```

## 📞 Yordam

Agar muammo bo'lsa, quyidagi ma'lumotlarni yig'ib oling:

1. Service status:
```bash
sudo systemctl status hr-bot-backend
sudo systemctl status hr-bot-telegram
sudo systemctl status nginx
```

2. Loglar:
```bash
sudo journalctl -u hr-bot-backend -n 100 > backend_logs.txt
sudo journalctl -u hr-bot-telegram -n 100 > telegram_logs.txt
```

3. Network:
```bash
sudo netstat -tlnp > network_status.txt
```

## ✅ Deployment Checklist

- [ ] Server'ga SSH orqali ulanish
- [ ] Kerakli dasturlarni o'rnatish
- [ ] PostgreSQL database yaratish
- [ ] Git'dan loyihani clone qilish
- [ ] Deployment script'ni ishga tushirish
- [ ] Backend .env faylini to'ldirish
- [ ] Telegram bot .env faylini to'ldirish
- [ ] Django superuser yaratish
- [ ] Services'larni ishga tushirish
- [ ] Services'larni tekshirish
- [ ] URL'larni test qilish
- [ ] Firewall sozlash
- [ ] Backup strategiyasini sozlash

---

**Muvaffaqiyatli deployment! 🎉**

