# HR Bot - Xodimlarni Testdan O'tkazish Tizimi

Telegram bot va Web platforma orqali xodimlarni testdan o'tkazish tizimi.

## 🎯 Loyiha tarkibi

- **Telegram Bot** - Foydalanuvchilar testdan o'tadi va ma'lumotlarini yuboradi
- **Telegram WebApp** - Test yechish va CV yuklash uchun web interfeys
- **Backend (Django REST Framework)** - API va ma'lumotlar bazasi boshqaruvi
- **Admin Panel (Django Admin)** - Testlar va natijalarni boshqarish
- **Dashboard** - Statistikalar va natijalarni ko'rish

## 🚀 O'rnatish va ishga tushirish

### Talablar

- Docker va Docker Compose
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+

### Docker orqali ishga tushirish

1. **Loyihani klon qiling:**
```bash
git clone <repository-url>
cd hr_bot
```

2. **Environment fayllarni yarating:**

Backend uchun:
```bash
cp backend/.env.example backend/.env
# backend/.env faylini tahrirlang va kerakli ma'lumotlarni kiriting
```

Telegram bot uchun:
```bash
cp telegram_bot/.env.example telegram_bot/.env
# telegram_bot/.env faylini tahrirlang
```

WebApp uchun:
```bash
cp webapp/.env.example webapp/.env
```

Dashboard uchun:
```bash
cp dashboard/.env.example dashboard/.env
```

3. **Docker Compose orqali ishga tushiring:**
```bash
docker-compose up -d
```

4. **Django migratsiyalarni bajaring:**
```bash
docker-compose exec backend python manage.py migrate
```

5. **Superuser yarating:**
```bash
docker-compose exec backend python manage.py createsuperuser
```

### Lokal o'rnatish (Docker bo'lmagan)

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

#### Telegram Bot

```bash
cd telegram_bot
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# .env faylini to'ldiring
python bot.py
```

#### WebApp

```bash
cd webapp
npm install
# .env faylini to'ldiring
npm run dev
```

#### Dashboard

```bash
cd dashboard
npm install
# .env faylini to'ldiring
npm run dev
```

## 📁 Loyiha struktura

```
hr_bot/
├── backend/              # Django backend
│   ├── hr_bot/          # Django project
│   ├── api/              # API app
│   ├── tests/            # Tests app
│   ├── users/            # Users app
│   └── manage.py
├── telegram_bot/         # Telegram bot
│   └── bot.py
├── webapp/               # Telegram WebApp (React)
│   └── src/
├── dashboard/            # Dashboard (React)
│   └── src/
├── nginx/                # Nginx configuration
└── docker-compose.yml
```

## 🔧 Konfiguratsiya

### Backend Settings

`backend/.env` faylida quyidagilarni sozlang:
- `SECRET_KEY` - Django secret key
- `DEBUG` - Debug mode (True/False)
- `DB_*` - PostgreSQL ma'lumotlari
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_WEBAPP_URL` - WebApp URL

### Telegram Bot Settings

`telegram_bot/.env` faylida:
- `TELEGRAM_BOT_TOKEN` - Bot token (@BotFather dan oling)
- `API_BASE_URL` - Backend API URL
- `TELEGRAM_WEBAPP_URL` - WebApp URL

## 📚 API Endpointlar

- `GET /api/tests/` - Testlar ro'yxati
- `GET /api/tests/{id}/` - Test tafsilotlari
- `GET /api/tests/{id}/questions/` - Test savollari
- `POST /api/results/` - Test natijasini yuborish
- `GET /api/results/` - Natijalar ro'yxati
- `POST /api/users/telegram_auth/` - Telegram orqali autentifikatsiya
- `POST /api/cvs/` - CV yuklash
- `GET /api/statistics/` - Statistika (admin uchun)

## 🎮 Foydalanish

### Telegram Bot

1. Telegram'da botni toping va `/start` buyrug'ini yuboring
2. Profilingizni to'ldiring (ism, familiya, telefon, email, lavozim)
3. Testni tanlang va boshlang
4. WebApp orqali testni yeching
5. Natijani ko'ring va CV yuklang

### Admin Panel

1. `http://localhost:8000/admin/` ga kiring
2. Superuser hisobi bilan kirish
3. Testlar, savollar, natijalarni boshqaring

### Dashboard

1. `http://localhost:3000/` ga kiring
2. Admin hisobi bilan kirish
3. Statistikalar va natijalarni ko'ring

## 🧪 Test qo'shish

Admin panel orqali:
1. Admin panelga kiring
2. "Tests" bo'limiga o'ting
3. "Add Test" tugmasini bosing
4. Test ma'lumotlarini kiriting
5. Savollar va javob variantlarini qo'shing

## 📊 Xususiyatlar

- ✅ Telegram bot orqali testdan o'tish
- ✅ WebApp orqali test yechish
- ✅ CV yuklash (PDF, DOCX)
- ✅ Avtomatik ball hisoblash
- ✅ Natijalarni saqlash va tahlil qilish
- ✅ Admin panel orqali boshqarish
- ✅ Dashboard orqali statistika
- ✅ Docker orqali oson deployment

## 🔒 Xavfsizlik

- JWT token autentifikatsiya
- CORS sozlamalari
- File upload validatsiya
- SQL injection himoyasi
- XSS himoyasi

## 📝 License

MIT License

## 👥 Muallif

HR Bot Team

