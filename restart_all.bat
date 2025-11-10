@echo off
REM HR Bot - Barcha servislarni qayta ishga tushirish va Telegram cache'larni tozalash
REM Windows CMD uchun

echo 🔄 HR Bot servislarini qayta ishga tushirish...
echo.

REM Logs papkasini yaratish
if not exist "logs" mkdir logs

REM 1. Barcha servislarni to'xtatish
echo 📋 Barcha servislarni to'xtatish...
echo.

REM Backend (Django) - port 8000
echo ⏹️  Backend (Django) ni to'xtatish (port 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo ✅ Backend to'xtatildi
)

REM WebApp (Vite) - port 5173
echo ⏹️  WebApp (Vite) ni to'xtatish (port 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo ✅ WebApp to'xtatildi
)

REM Dashboard (Vite) - port 3000
echo ⏹️  Dashboard (Vite) ni to'xtatish (port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo ✅ Dashboard to'xtatildi
)

REM Telegram Bot
echo ⏹️  Telegram Bot ni to'xtatish...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *bot.py*" >nul 2>&1
taskkill /F /IM pythonw.exe /FI "WINDOWTITLE eq *bot.py*" >nul 2>&1
echo ✅ Telegram Bot to'xtatildi

REM Redis (agar ishlatilsa)
echo ⏹️  Redis cache'larni tozalash...
where redis-cli >nul 2>&1
if %ERRORLEVEL% == 0 (
    redis-cli FLUSHALL >nul 2>&1
    if %ERRORLEVEL% == 0 (
        echo ✅ Redis cache tozalandi
    ) else (
        echo ⚠️  Redis ishlamayapti yoki cache bo'sh
    )
) else (
    echo ⚠️  Redis o'rnatilmagan
)

REM 2. Kichik kutish
echo.
echo ⏳ 3 soniya kutish...
timeout /t 3 /nobreak >nul

REM 3. Barcha servislarni qayta ishga tushirish
echo.
echo 🚀 Barcha servislarni qayta ishga tushirish...
echo.

REM Backend (Django)
echo ▶️  Backend (Django) ni ishga tushirish...
cd backend
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)
start /B python manage.py runserver 0.0.0.0:8000 > ..\logs\backend.log 2>&1
cd ..
timeout /t 2 /nobreak >nul
netstat -aon | findstr :8000 | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo ✅ Backend Django ishlayapti
) else (
    echo ❌ Backend Django ishlamayapti
)

REM WebApp (Vite)
echo ▶️  WebApp (Vite) ni ishga tushirish...
cd webapp
start /B npm run dev > ..\logs\webapp.log 2>&1
cd ..
timeout /t 2 /nobreak >nul
netstat -aon | findstr :5173 | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo ✅ WebApp Vite ishlayapti
) else (
    echo ❌ WebApp Vite ishlamayapti
)

REM Dashboard (Vite)
echo ▶️  Dashboard (Vite) ni ishga tushirish...
cd dashboard
start /B npm run dev > ..\logs\dashboard.log 2>&1
cd ..
timeout /t 2 /nobreak >nul
netstat -aon | findstr :3000 | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo ✅ Dashboard Vite ishlayapti
) else (
    echo ❌ Dashboard Vite ishlamayapti
)

REM Telegram Bot
echo ▶️  Telegram Bot ni ishga tushirish...
cd telegram_bot
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)
start /B python bot.py > ..\logs\telegram_bot.log 2>&1
cd ..
timeout /t 2 /nobreak >nul
echo ✅ Telegram Bot ishga tushirildi

REM 4. Natijalar
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ✅ Barcha servislar qayta ishga tushirildi!
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 📊 Servislar holati:
echo.
netstat -aon | findstr :8000 | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo ✅ Backend Django ishlayapti
) else (
    echo ❌ Backend Django ishlamayapti
)
netstat -aon | findstr :5173 | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo ✅ WebApp Vite ishlayapti
) else (
    echo ❌ WebApp Vite ishlamayapti
)
netstat -aon | findstr :3000 | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo ✅ Dashboard Vite ishlayapti
) else (
    echo ❌ Dashboard Vite ishlamayapti
)
echo ✅ Telegram Bot ishga tushirildi
echo.
echo 📝 Log fayllar:
echo   - Backend: logs\backend.log
echo   - WebApp: logs\webapp.log
echo   - Dashboard: logs\dashboard.log
echo   - Telegram Bot: logs\telegram_bot.log
echo.
echo 🎉 Tugadi!
pause
