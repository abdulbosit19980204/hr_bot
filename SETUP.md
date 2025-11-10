# HR Bot - O'rnatish va Ishlatish Qo'llanmasi

## 📋 Talablar

- Docker va Docker Compose
- Python 3.11+ (lokal o'rnatish uchun)
- Node.js 18+ (lokal o'rnatish uchun)
- PostgreSQL 15+ (lokal o'rnatish uchun)

## 🚀 Docker orqali ishga tushirish (Tavsiya etiladi)

### 1. Loyihani klon qiling yoki yuklab oling

```bash
cd hr_bot
```

### 2. Environment fayllarni yarating

Har bir komponent uchun `.env.example` faylini `.env` ga nusxalang va to'ldiring:

#### Backend (.env)
```bash
cp backend/.env.example backend/.env
# backend/.env faylini tahrirlang
```

**Muhim sozlamalar:**
- `SECRET_KEY` - Django secret key (yangi yarating)
- `TELEGRAM_BOT_TOKEN` - @BotFather dan olingan bot token
- `TELEGRAM_WEBAPP_URL` - WebApp URL (production'da HTTPS bo'lishi kerak)

#### Telegram Bot (.env)
```bash
cp telegram_bot/.env.example telegram_bot/.env
# telegram_bot/.env faylini tahrirlang
```

**Muhim sozlamalar:**
- `TELEGRAM_BOT_TOKEN` - @BotFather dan olingan bot token
- `API_BASE_URL` - Backend API URL (Docker ichida: http://backend:8000/api)
- `TELEGRAM_WEBAPP_URL` - WebApp URL (production'da HTTPS)

#### WebApp (.env)
```bash
cp webapp/.env.example webapp/.env
# webapp/.env faylini tahrirlang
```

**Muhim sozlamalar:**
- `VITE_API_BASE_URL` - Backend API URL

#### Dashboard (.env)
```bash
cp dashboard/.env.example dashboard/.env
# dashboard/.env faylini tahrirlang
```

**Muhim sozlamalar:**
- `VITE_API_BASE_URL` - Backend API URL

### 3. Docker Compose orqali ishga tushiring

```bash
docker-compose up -d
```

### 4. Database migratsiyalarni bajaring

```bash
docker-compose exec backend python manage.py migrate
```

### 5. Superuser yarating

```bash
docker-compose exec backend python manage.py createsuperuser
```

### 6. Static fayllarni yig'ing

```bash
docker-compose exec backend python manage.py collectstatic --noinput
```

## 📱 Telegram Bot sozlash

1. [@BotFather](https://t.me/BotFather) ga kiring
2. `/newbot` buyrug'ini yuboring
3. Bot nomi va username ni kiriting
4. Olingan token ni `telegram_bot/.env` fayliga qo'ying
5. WebApp uchun bot sozlamalarini yangilang:
   - `/setmenubutton` - WebApp tugmasini sozlang
   - WebApp URL ni kiriting (HTTPS bo'lishi kerak)

## 🌐 Production Deployment

### HTTPS sozlash

Production'da WebApp HTTPS orqali ishlashi kerak. Quyidagilarni bajaring:

1. SSL sertifikat oling (Let's Encrypt yoki boshqa)
2. Nginx konfiguratsiyasini yangilang (`nginx/nginx.conf`)
3. `TELEGRAM_WEBAPP_URL` ni HTTPS URL ga o'zgartiring

### Environment o'zgaruvchilari

Production'da quyidagilarni o'zgartiring:

- `DEBUG=False`
- `SECRET_KEY` - kuchli secret key
- `ALLOWED_HOSTS` - domen nomlari
- Database parollari - kuchli parollar

## 🔧 Lokal o'rnatish (Docker bo'lmagan)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Telegram Bot

```bash
cd telegram_bot
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# .env faylini to'ldiring
python bot.py
```

### WebApp

```bash
cd webapp
npm install
# .env faylini to'ldiring
npm run dev
```

### Dashboard

```bash
cd dashboard
npm install
# .env faylini to'ldiring
npm run dev
```

## 📊 Admin Panel

1. `http://localhost:8000/admin/` ga kiring
2. Superuser hisobi bilan kirish
3. Testlar, savollar, natijalarni boshqaring

### Excel orqali test import qilish

1. Admin panelda "Tests" bo'limiga kiring
2. "Excel orqali import qilish" tugmasini bosing
3. Excel fayl formatiga mos fayl yuklang

**Excel fayl formati:**
- Qator 1: Test nomi
- Qator 2: Tavsif
- Qator 3: Lavozim
- Qator 4: Vaqt chegarasi (daqiqalarda)
- Qator 5: O'tish balli (foizda)
- Qator 6: Bo'sh qator
- Qator 7+: Savollar
  - A ustuni: Savol matni
  - B-E ustunlar: Javob variantlari
  - F ustuni: To'g'ri javob (1, 2, 3 yoki 4)

### Natijalarni eksport qilish

1. Admin panelda "Test Results" bo'limiga kiring
2. Kerakli natijalarni tanlang
3. "Actions" dan "Export to Excel" yoki "Export to CSV" ni tanlang

## 🎯 Foydalanish

### Telegram Bot orqali

1. Telegram'da botni toping
2. `/start` buyrug'ini yuboring
3. Profilingizni to'ldiring
4. Testni tanlang va boshlang
5. WebApp orqali testni yeching
6. Natijani ko'ring va CV yuklang

### Dashboard orqali

1. `http://localhost:3000/` ga kiring
2. Admin hisobi bilan kirish
3. Statistikalar va natijalarni ko'ring

## 🐛 Muammolarni hal qilish

### Database xatoliklari

```bash
docker-compose exec backend python manage.py migrate
```

### Static fayllar ko'rinmayapti

```bash
docker-compose exec backend python manage.py collectstatic --noinput
```

### Bot ishlamayapti

1. Bot token to'g'riligini tekshiring
2. Backend API URL ni tekshiring
3. Loglarni ko'ring: `docker-compose logs telegram_bot`

### WebApp ishlamayapti

1. HTTPS sozlamalarini tekshiring
2. API URL ni tekshiring
3. Browser console'da xatolarni ko'ring

## 📝 Qo'shimcha ma'lumotlar

- API dokumentatsiya: `http://localhost:8000/api/`
- Admin panel: `http://localhost:8000/admin/`
- WebApp: `http://localhost:5173/`
- Dashboard: `http://localhost:3000/`

## 🔒 Xavfsizlik

- Production'da `DEBUG=False` qiling
- Kuchli `SECRET_KEY` ishlating
- Database parollarini himoya qiling
- HTTPS ishlating
- CORS sozlamalarini tekshiring

