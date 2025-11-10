# WebApp va Dashboard ni Run Qilish

## 1. WebApp ni Run Qilish

WebApp Telegram WebApp uchun test yechish interfeysi.

### Qadamlar:

1. **WebApp papkasiga kirish:**
```bash
cd webapp
```

2. **Dependencies o'rnatish (agar hali o'rnatilmagan bo'lsa):**
```bash
npm install
```

3. **Development serverni ishga tushirish:**
```bash
npm run dev
```

4. **WebApp quyidagi portda ishga tushadi:**
- URL: `http://localhost:5173`
- Port: `5173`

5. **Environment variables (ixtiyoriy):**
Agar API URL boshqa bo'lsa, `.env` fayl yaratib quyidagilarni qo'shing:
```
VITE_API_BASE_URL=http://localhost:8000/api
```

## 2. Dashboard ni Run Qilish

Dashboard - bu statistika va natijalarni ko'rish uchun admin paneli.

### Qadamlar:

1. **Dashboard papkasiga kirish:**
```bash
cd dashboard
```

2. **Dependencies o'rnatish (agar hali o'rnatilmagan bo'lsa):**
```bash
npm install
```

3. **Development serverni ishga tushirish:**
```bash
npm run dev
```

4. **Dashboard quyidagi portda ishga tushadi:**
- URL: `http://localhost:3000`
- Port: `3000`

5. **Environment variables (ixtiyoriy):**
Agar API URL boshqa bo'lsa, `.env` fayl yaratib quyidagilarni qo'shing:
```
VITE_API_BASE_URL=http://localhost:8000/api
```

## 3. Barcha Servislarni Bir Vaqtda Run Qilish

### Terminal 1 - Backend:
```bash
cd backend
py manage.py runserver
```

### Terminal 2 - WebApp:
```bash
cd webapp
npm run dev
```

### Terminal 3 - Dashboard:
```bash
cd dashboard
npm run dev
```

### Terminal 4 - Telegram Bot:
```bash
cd telegram_bot
python bot.py
```

## 4. Statistics Endpoint Muammosi

Agar Statistics endpoint 401 (Unauthorized) xatolik qaytarsa:

1. **Backend settings.py ni tekshiring:**
   - `REST_FRAMEWORK` settings da `DEFAULT_PERMISSION_CLASSES` ni tekshiring
   - `StatisticsView` da `permission_classes = [AllowAny]` bo'lishi kerak

2. **CORS settings ni tekshiring:**
   - `CORS_ALLOWED_ORIGINS` ga Dashboard URL qo'shiling
   - Development uchun `CORS_ALLOW_ALL_ORIGINS = True` bo'lishi mumkin

3. **Browser console da xatoliklarni tekshiring:**
   - Network tab da statistics request ni tekshiring
   - Response headers va status code ni ko'ring

## 5. Muammolarni Hal Qilish

### WebApp ishlamayapti:
- Port 5173 band bo'lishi mumkin
- `vite.config.js` da portni o'zgartiring
- Yoki `npm run dev -- --port 5174` ishlating

### Dashboard ishlamayapti:
- Port 3000 band bo'lishi mumkin
- `vite.config.js` da portni o'zgartiring
- Yoki `npm run dev -- --port 3001` ishlating

### Statistics 401 xatolik:
- Backend server ishlayotganini tekshiring
- CORS settings ni tekshiring
- Browser console da xatoliklarni ko'ring

## 6. Production Build

### WebApp:
```bash
cd webapp
npm run build
```

### Dashboard:
```bash
cd dashboard
npm run build
```

Build qilingan fayllar `dist` papkasida bo'ladi.

