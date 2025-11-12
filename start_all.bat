@echo off
chcp 65001 >nul
echo ========================================
echo HR Bot - Full Startup Script
echo ========================================
echo.

REM Get the script directory
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM Check if Python is available (try multiple ways)
set PYTHON_CMD=
python --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python
) else (
    py --version >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=py
    ) else (
        python3 --version >nul 2>&1
        if not errorlevel 1 (
            set PYTHON_CMD=python3
        ) else (
            echo [ERROR] Python not found! Please install Python 3.11+
            echo Trying to find Python in common locations...
            if exist "C:\Python311\python.exe" (
                set PYTHON_CMD=C:\Python311\python.exe
                echo [INFO] Found Python at C:\Python311\python.exe
            ) else if exist "C:\Python312\python.exe" (
                set PYTHON_CMD=C:\Python312\python.exe
                echo [INFO] Found Python at C:\Python312\python.exe
            ) else if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
                set PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe
                echo [INFO] Found Python at %LOCALAPPDATA%\Programs\Python\Python311\python.exe
            ) else if exist "%SCRIPT_DIR%backend\venv\Scripts\python.exe" (
                set PYTHON_CMD=%SCRIPT_DIR%backend\venv\Scripts\python.exe
                echo [INFO] Found Python in backend venv
            ) else if exist "%SCRIPT_DIR%telegram_bot\venv\Scripts\python.exe" (
                set PYTHON_CMD=%SCRIPT_DIR%telegram_bot\venv\Scripts\python.exe
                echo [INFO] Found Python in telegram_bot venv
            ) else (
                echo [ERROR] Python not found in common locations!
                echo Please add Python to PATH or install Python 3.11+
                echo Or create a virtual environment in backend/venv
                pause
                exit /b 1
            )
        )
    )
)
echo [INFO] Using Python: %PYTHON_CMD%

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
%PYTHON_CMD% manage.py collectstatic --noinput >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Failed to collect static files, continuing...
)
cd ..

echo [2/6] Starting Backend (port 8000)...
start "HR Bot - Backend" /MIN cmd /k "cd /d %SCRIPT_DIR%backend && %PYTHON_CMD% manage.py runserver 0.0.0.0:8000"
timeout /t 3 /nobreak >nul

echo [3/6] Starting WebApp (port 5173)...
start "HR Bot - WebApp" /MIN cmd /k "cd /d %SCRIPT_DIR%webapp && npm run dev"
timeout /t 5 /nobreak >nul

echo [4/6] Starting Nginx (port 8080)...
REM Stop existing Nginx if running
taskkill /F /IM nginx.exe >nul 2>&1
timeout /t 1 /nobreak >nul
REM Use full path to nginx.exe
set NGINX_EXE=%SCRIPT_DIR%nginx\nginx-1.28.0\nginx.exe
if not exist "%NGINX_EXE%" (
    echo [ERROR] Nginx not found at: %NGINX_EXE%
    echo Please install Nginx or update the path in start_all.bat
    pause
    exit /b 1
)
REM Create logs and temp directories if they don't exist
if not exist "%SCRIPT_DIR%nginx\logs" mkdir "%SCRIPT_DIR%nginx\logs"
if not exist "%SCRIPT_DIR%nginx\temp" mkdir "%SCRIPT_DIR%nginx\temp"
if not exist "%SCRIPT_DIR%nginx\temp\client_body_temp" mkdir "%SCRIPT_DIR%nginx\temp\client_body_temp"
if not exist "%SCRIPT_DIR%nginx\temp\fastcgi_temp" mkdir "%SCRIPT_DIR%nginx\temp\fastcgi_temp"
if not exist "%SCRIPT_DIR%nginx\temp\proxy_temp" mkdir "%SCRIPT_DIR%nginx\temp\proxy_temp"
if not exist "%SCRIPT_DIR%nginx\temp\scgi_temp" mkdir "%SCRIPT_DIR%nginx\temp\scgi_temp"
if not exist "%SCRIPT_DIR%nginx\temp\uwsgi_temp" mkdir "%SCRIPT_DIR%nginx\temp\uwsgi_temp"
REM Test configuration first
"%NGINX_EXE%" -t -p "%SCRIPT_DIR%nginx" -c "nginx.local.conf" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Nginx configuration test failed, but continuing...
)
REM Start Nginx (change to nginx directory first)
cd /d "%SCRIPT_DIR%nginx"
start "HR Bot - Nginx" /MIN cmd /k "cd /d %SCRIPT_DIR%nginx && %NGINX_EXE% -p %SCRIPT_DIR%nginx -c nginx.local.conf"
cd /d "%SCRIPT_DIR%"
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

