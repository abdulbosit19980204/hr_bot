# Ngrok Setup - Variant 2: Bitta Tunnel'da WebApp va Backend

Bu qo'llanma WebApp va Backend API'ni bitta Ngrok tunnel orqali expose qilish uchun.

## 📋 Talablar

1. **Nginx** - Reverse proxy sifatida
2. **Ngrok** - HTTPS tunnel yaratish uchun
3. **Backend** - Port 8000'da ishlayotgan bo'lishi kerak
4. **WebApp** - Port 5173'da ishlayotgan bo'lishi kerak

## 🚀 O'rnatish va Ishlatish

### 1. Nginx o'rnatish

#### Windows:
```powershell
# Chocolatey orqali
choco install nginx

# Yoki manuel yuklab oling: https://nginx.org/en/download.html
```

#### Linux/Mac:
```bash
# Ubuntu/Debian
sudo apt-get install nginx

# Mac
brew install nginx
```

### 2. Nginx konfiguratsiyasini sozlash

1. `nginx/nginx.local.conf` faylini oching
2. Static va media file path'larini o'zgartiring:
   ```nginx
   location /static/ {
       alias D:/coding/hr_bot/backend/staticfiles/;  # Windows
       # alias /home/user/hr_bot/backend/staticfiles/;  # Linux/Mac
   }
   
   location /media/ {
       alias D:/coding/hr_bot/backend/media/;  # Windows
       # alias /home/user/hr_bot/backend/media/;  # Linux/Mac
   }
   ```

3. Nginx konfiguratsiyasini yuklang:
   ```bash
   # Windows (PowerShell as Administrator)
   nginx -t -c "D:\coding\hr_bot\nginx\nginx.local.conf"
   nginx -c "D:\coding\hr_bot\nginx\nginx.local.conf"
   
   # Linux/Mac
   sudo nginx -t -c /path/to/hr_bot/nginx/nginx.local.conf
   sudo nginx -c /path/to/hr_bot/nginx/nginx.local.conf
   ```

### 3. Backend va WebApp'ni ishga tushirish

#### Terminal 1: Backend
```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

#### Terminal 2: WebApp
```bash
cd webapp
npm run dev
```

### 4. Ngrok'ni ishga tushirish

#### Terminal 3: Ngrok
```bash
# Nginx port'iga tunnel qiling (8080)
ngrok http 8080
```

Ngrok sizga HTTPS URL beradi, masalan:
```
https://unfunereal-matilda-frenular.ngrok-free.dev
```

### 5. Environment variable'larni yangilash

#### `webapp/.env`:
```env
# Ngrok URL avtomatik aniqlanadi, lekin agar kerak bo'lsa:
# VITE_API_BASE_URL=https://unfunereal-matilda-frenular.ngrok-free.dev/api
```

#### `telegram_bot/.env`:
```env
TELEGRAM_WEBAPP_URL=https://unfunereal-matilda-frenular.ngrok-free.dev
API_BASE_URL=https://unfunereal-matilda-frenular.ngrok-free.dev/api
```

#### `backend/.env`:
```env
ALLOWED_HOSTS=localhost,127.0.0.1,unfunereal-matilda-frenular.ngrok-free.dev
CORS_ALLOWED_ORIGINS=https://unfunereal-matilda-frenular.ngrok-free.dev
```

## 🔧 Nginx'ni boshqarish

### Nginx'ni to'xtatish:
```bash
# Windows
nginx -s stop

# Linux/Mac
sudo nginx -s stop
```

### Nginx'ni qayta yuklash:
```bash
# Windows
nginx -s reload

# Linux/Mac
sudo nginx -s reload
```

### Nginx'ni tekshirish:
```bash
# Windows
nginx -t -c "D:\coding\hr_bot\nginx\nginx.local.conf"

# Linux/Mac
sudo nginx -t -c /path/to/hr_bot/nginx/nginx.local.conf
```

## 📊 URL Strukturasi

Ngrok tunnel orqali quyidagi URL'lar mavjud:

- **WebApp**: `https://your-ngrok-url.ngrok-free.dev/`
- **Backend API**: `https://your-ngrok-url.ngrok-free.dev/api/`
- **Admin Panel**: `https://your-ngrok-url.ngrok-free.dev/admin/`
- **Static Files**: `https://your-ngrok-url.ngrok-free.dev/static/`
- **Media Files**: `https://your-ngrok-url.ngrok-free.dev/media/`

## ⚠️ Muhim Eslatmalar

1. **Ngrok Free Plan**: 
   - Har safar qayta ishga tushirilganda URL o'zgaradi
   - Tunnel soni cheklangan
   - Bandwidth cheklangan

2. **Ngrok Paid Plan**:
   - Doimiy URL (custom domain)
   - Cheksiz tunnel
   - Katta bandwidth

3. **Nginx Port**:
   - Default port 8080 ishlatilgan (80 port root huquqlar talab qiladi)
   - Agar 80 port ishlatmoqchi bo'lsangiz, root/sudo huquqlari kerak

4. **Static Files**:
   - Backend'da `python manage.py collectstatic` ni ishga tushiring
   - Nginx konfiguratsiyasida static file path'ni to'g'ri sozlang

## 🐛 Muammolarni hal qilish

### 404 Xatolik
- Nginx'ni qayta yuklang: `nginx -s reload`
- Backend va WebApp ishlayotganini tekshiring
- Ngrok tunnel faol ekanligini tekshiring

### CORS Xatolik
- Backend `settings.py` da `CORS_ALLOWED_ORIGINS` ga Ngrok URL qo'shing
- Nginx konfiguratsiyasida CORS header'lar qo'shilgan

### Static Files ko'rinmayapti
- `python manage.py collectstatic` ni ishga tushiring
- Nginx konfiguratsiyasida static file path'ni tekshiring
- File permissions'ni tekshiring

## 📝 Avtomatlashtirish

Windows uchun `start_ngrok.bat` yoki Linux/Mac uchun `start_ngrok.sh` skript yaratishingiz mumkin:

### Windows (`start_ngrok.bat`):
```batch
@echo off
echo Starting Nginx...
start "Nginx" cmd /k "nginx -c D:\coding\hr_bot\nginx\nginx.local.conf"
timeout /t 2
echo Starting Ngrok...
start "Ngrok" cmd /k "ngrok http 8080"
echo Done! Check Ngrok URL in the Ngrok window.
pause
```

### Linux/Mac (`start_ngrok.sh`):
```bash
#!/bin/bash
echo "Starting Nginx..."
sudo nginx -c /path/to/hr_bot/nginx/nginx.local.conf
sleep 2
echo "Starting Ngrok..."
ngrok http 8080 &
echo "Done! Check Ngrok URL."
```

