@echo off
chcp 65001 >nul
echo ========================================
echo HR Bot - Full Startup Script
echo ========================================
echo.

REM Get the script directory
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.11+
    pause
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Please install Node.js 18+
    pause
    exit /b 1
)

REM Check if Nginx is available
nginx -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Nginx not found! Please install Nginx
    echo Download from: https://nginx.org/en/download.html
    pause
    exit /b 1
)

REM Check if Ngrok is available
ngrok version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Ngrok not found! Please install Ngrok
    echo Download from: https://ngrok.com/download
    pause
    exit /b 1
)

echo [1/6] Collecting static files...
cd backend
if not exist staticfiles mkdir staticfiles
python manage.py collectstatic --noinput >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Failed to collect static files, continuing...
)
cd ..

echo [2/6] Starting Backend (port 8000)...
start "HR Bot - Backend" /MIN cmd /k "cd /d %SCRIPT_DIR%backend && python manage.py runserver 0.0.0.0:8000"
timeout /t 3 /nobreak >nul

echo [3/6] Starting WebApp (port 5173)...
start "HR Bot - WebApp" /MIN cmd /k "cd /d %SCRIPT_DIR%webapp && npm run dev"
timeout /t 5 /nobreak >nul

echo [4/6] Starting Nginx (port 8080)...
REM Stop existing Nginx if running
taskkill /F /IM nginx.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "HR Bot - Nginx" /MIN cmd /k "nginx -c %SCRIPT_DIR%nginx\nginx.local.conf"
timeout /t 2 /nobreak >nul

echo [5/6] Starting Ngrok...
start "HR Bot - Ngrok" cmd /k "ngrok http 8080"

echo [6/6] Waiting for services to start...
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo All services started!
echo ========================================
echo.
echo Services:
echo   - Backend:    http://localhost:8000
echo   - WebApp:     http://localhost:5173
echo   - Nginx:      http://localhost:8080
echo   - Ngrok:      Check Ngrok window for HTTPS URL
echo.
echo Check Ngrok window for your HTTPS URL!
echo Example: https://xxxxx.ngrok-free.dev
echo.
echo Press any key to exit...
pause >nul

