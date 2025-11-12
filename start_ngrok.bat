@echo off
echo ========================================
echo HR Bot - Ngrok Setup (Variant 2)
echo ========================================
echo.

REM Check if Nginx is running
tasklist /FI "IMAGENAME eq nginx.exe" 2>NUL | find /I /N "nginx.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [INFO] Nginx is already running
) else (
    echo [INFO] Starting Nginx...
    start "Nginx" /MIN cmd /k "nginx -c %~dp0nginx\nginx.local.conf"
    timeout /t 3 /nobreak >nul
)

REM Check if Backend is running on port 8000
netstat -an | find "8000" | find "LISTENING" >nul
if "%ERRORLEVEL%"=="0" (
    echo [INFO] Backend is running on port 8000
) else (
    echo [WARNING] Backend is not running on port 8000
    echo [WARNING] Please start backend: cd backend ^&^& python manage.py runserver 0.0.0.0:8000
)

REM Check if WebApp is running on port 5173
netstat -an | find "5173" | find "LISTENING" >nul
if "%ERRORLEVEL%"=="0" (
    echo [INFO] WebApp is running on port 5173
) else (
    echo [WARNING] WebApp is not running on port 5173
    echo [WARNING] Please start webapp: cd webapp ^&^& npm run dev
)

echo.
echo [INFO] Starting Ngrok on port 8080...
echo [INFO] Ngrok will expose Nginx (which proxies Backend and WebApp)
echo.
start "Ngrok" cmd /k "ngrok http 8080"
echo.
echo ========================================
echo Done! Check Ngrok URL in the Ngrok window.
echo ========================================
echo.
echo Press any key to exit...
pause >nul

