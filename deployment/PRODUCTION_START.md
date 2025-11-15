# HR Bot Production Start Guide

## 📋 Talablar

- Python 3.11+
- Node.js 18+
- Gunicorn
- Virtual environments (backend va telegram_bot uchun)
- Nginx (ixtiyoriy, reverse proxy uchun)

## 🚀 Production'da Ishga Tushirish

### 1. Skriptni ishga tushirish

```bash
cd /path/to/hr_bot
chmod +x deployment/start_production.sh
./deployment/start_production.sh
```

### 2. Environment Variables

Loyiha root papkasida `.env` faylini yarating:

```env
# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-domain.com,localhost,127.0.0.1

# Database
USE_POSTGRES=True
DB_NAME=hr_bot_db
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=localhost
DB_PORT=5432

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBAPP_URL=https://your-domain.com

# CORS
CORS_ALLOWED_ORIGINS=https://your-domain.com,http://localhost:5173
```

### 3. Portlar

Default portlar:
- **Backend**: 8000
- **WebApp**: 5173
- **Dashboard**: 3000

Portlarni o'zgartirish uchun environment variable'lar:

```bash
export BACKEND_PORT=8000
export WEBAPP_PORT=5173
export DASHBOARD_PORT=3000
./deployment/start_production.sh
```

### 4. Skript Nima Qiladi?

1. **Mavjud processlarni to'xtatadi** (portlar bo'sh bo'lishi uchun)
2. **Backend'ni ishga tushiradi**:
   - Virtual environment'ni aktivlashtiradi
   - Migration'larni tekshiradi va ishga tushiradi
   - Static fayllarni yig'adi
   - Gunicorn'ni ishga tushiradi
3. **Telegram Bot'ni ishga tushiradi**:
   - Virtual environment'ni aktivlashtiradi
   - Bot'ni background'da ishga tushiradi
4. **WebApp'ni build qiladi va ishga tushiradi**:
   - Production build yaratadi
   - Vite preview server'ni ishga tushiradi
5. **Dashboard'ni build qiladi va ishga tushiradi**:
   - Production build yaratadi
   - Vite preview server'ni ishga tushiradi

### 5. Servislarni To'xtatish

```bash
./deployment/stop_production.sh
```

Yoki:

```bash
kill $(cat backend.pid) $(cat telegram_bot.pid) $(cat webapp.pid) $(cat dashboard.pid)
```

## 📊 Loglar

Loglar quyidagi joylarda:

- **Backend**: `backend/logs/gunicorn.log`
- **Telegram Bot**: `telegram_bot/logs/telegram_bot.log`
- **WebApp**: `webapp/webapp.log`
- **Dashboard**: `dashboard/dashboard.log`

## 🔍 Tekshirish

### Backend tekshirish:
```bash
curl http://localhost:8000/api/
```

### WebApp tekshirish:
```bash
curl http://localhost:5173/
```

### Dashboard tekshirish:
```bash
curl http://localhost:3000/
```

## ⚙️ Nginx Configuration

Agar Nginx reverse proxy ishlatmoqchi bo'lsangiz, `deployment/nginx_hr_bot.conf` faylini ishlating.

## 🐛 Muammolarni Hal Qilish

### Port allaqachon ishlatilmoqda:
```bash
# Port'ni tekshirish
lsof -i :8000

# Process'ni to'xtatish
kill -9 $(lsof -ti:8000)
```

### Virtual environment topilmayapti:
```bash
# Backend uchun
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Telegram bot uchun
cd telegram_bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Build xatoliklari:
```bash
# WebApp build log'ini ko'rish
cat webapp/webapp_build.log

# Dashboard build log'ini ko'rish
cat dashboard/dashboard_build.log
```

## 📝 Eslatmalar

- Production'da `DEBUG=False` bo'lishi kerak
- `SECRET_KEY` ni xavfsiz saqlang
- Database backup'larini muntazam oling
- Log fayllarini muntazam tozalang
- SSL sertifikatlarini o'rnating (HTTPS uchun)

## 🔄 Qayta Ishga Tushirish

```bash
./deployment/stop_production.sh
./deployment/start_production.sh
```

