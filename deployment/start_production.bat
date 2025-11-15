@echo off
REM HR Bot Production Start Script for Windows
REM This script starts backend, telegram bot, webapp, and dashboard in production mode

setlocal enabledelayedexpansion

REM Project directory (adjust this to your actual path)
if "%PROJECT_DIR%"=="" set PROJECT_DIR=%~dp0..
set BACKEND_DIR=%PROJECT_DIR%\backend
set TELEGRAM_BOT_DIR=%PROJECT_DIR%\telegram_bot
set WEBAPP_DIR=%PROJECT_DIR%\webapp
set DASHBOARD_DIR=%PROJECT_DIR%\dashboard

REM Ports
if "%BACKEND_PORT%"=="" set BACKEND_PORT=8000
if "%WEBAPP_PORT%"=="" set WEBAPP_PORT=5173
if "%DASHBOARD_PORT%"=="" set DASHBOARD_PORT=3000

echo.
echo ========================================
echo   HR Bot Production Start Script
echo ========================================
echo.

REM Function to check if port is in use and kill processes
:check_port
setlocal enabledelayedexpansion
set "PORT_NUM=%~1"
if "!PORT_NUM!"=="" exit /b 0
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":!PORT_NUM!" ^| findstr "LISTENING"') do (
    echo [*] Port !PORT_NUM! is already in use (PID: %%a), killing...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 /nobreak >nul
)
endlocal
exit /b 0

REM Kill existing processes
echo [*] Cleaning up existing processes...
echo.

REM Kill backend processes
echo [*] Stopping backend on port %BACKEND_PORT%...
call :check_port %BACKEND_PORT%

REM Kill telegram bot processes
echo [*] Stopping telegram bot...
taskkill /F /FI "WINDOWTITLE eq *bot.py*" >nul 2>&1
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO CSV 2^>nul ^| findstr /i "bot.py"') do (
    set PID=%%a
    set PID=!PID:"=!
    if not "!PID!"=="" taskkill /F /PID !PID! >nul 2>&1
)

REM Kill webapp processes
echo [*] Stopping webapp on port %WEBAPP_PORT%...
call :check_port %WEBAPP_PORT%

REM Kill dashboard processes
echo [*] Stopping dashboard on port %DASHBOARD_PORT%...
call :check_port %DASHBOARD_PORT%

echo [OK] All ports cleared
echo.

REM Start Backend
echo ========================================
echo   Starting Django Backend
echo ========================================
cd /d "%BACKEND_DIR%"

REM Activate virtual environment
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else if exist "..\venv\Scripts\activate.bat" (
    call ..\venv\Scripts\activate.bat
) else (
    echo [ERROR] Virtual environment not found
    echo Please create virtual environment first:
    echo   cd backend
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements.txt
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" if not exist "..\.env" (
    echo [WARNING] .env file not found. Please create one.
)

REM Check if migrations are needed
echo [*] Checking migrations...
python manage.py migrate --check >nul 2>&1
if errorlevel 1 (
    echo [*] Running migrations...
    python manage.py migrate
)

REM Collect static files
echo [*] Collecting static files...
python manage.py collectstatic --noinput

REM Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

REM Start Gunicorn in background
echo [*] Starting Gunicorn on port %BACKEND_PORT%...

REM Check if gunicorn_config.py exists
if exist "%PROJECT_DIR%\deployment\gunicorn_config.py" (
    start /B "" python -m gunicorn --config %PROJECT_DIR%\deployment\gunicorn_config.py --bind 0.0.0.0:%BACKEND_PORT% hr_bot.wsgi:application > logs\gunicorn.log 2>&1
) else (
    start /B "" python -m gunicorn --bind 0.0.0.0:%BACKEND_PORT% --workers 3 --timeout 120 --keep-alive 2 --max-requests 1000 --max-requests-jitter 50 --access-logfile logs\gunicorn_access.log --error-logfile logs\gunicorn_error.log hr_bot.wsgi:application > logs\gunicorn.log 2>&1
)

REM Get backend PID (approximate)
timeout /t 3 /nobreak >nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%BACKEND_PORT%" ^| findstr "LISTENING"') do (
    echo [OK] Backend started (PID: %%a)
    echo %%a > "%PROJECT_DIR%\backend.pid"
    goto backend_started
)
echo [WARNING] Backend might still be starting...
echo          Check logs: %BACKEND_DIR%\logs\gunicorn.log
:backend_started

echo.

REM Start Telegram Bot
echo ========================================
echo   Starting Telegram Bot
echo ========================================
cd /d "%TELEGRAM_BOT_DIR%"

REM Activate virtual environment
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else if exist "..\venv\Scripts\activate.bat" (
    call ..\venv\Scripts\activate.bat
) else (
    echo [ERROR] Telegram bot virtual environment not found
    echo Please create virtual environment first:
    echo   cd telegram_bot
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements.txt
    exit /b 1
)

REM Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

REM Start telegram bot in background
echo [*] Starting Telegram Bot...
start /B "" python bot.py > logs\telegram_bot.log 2>&1

timeout /t 3 /nobreak >nul
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO CSV 2^>nul ^| findstr /i "bot.py"') do (
    set BOT_PID=%%a
    set BOT_PID=!BOT_PID:"=!
    if not "!BOT_PID!"=="" (
        echo [OK] Telegram Bot started (PID: !BOT_PID!)
        echo !BOT_PID! > "%PROJECT_DIR%\telegram_bot.pid"
        goto telegram_started
    )
)
echo [OK] Telegram Bot started
echo [WARNING] Could not get PID, check logs: %TELEGRAM_BOT_DIR%\logs\telegram_bot.log
:telegram_started

echo.

REM Start WebApp
echo ========================================
echo   Starting WebApp
echo ========================================
cd /d "%WEBAPP_DIR%"

REM Build WebApp
echo [*] Building WebApp...
set NODE_ENV=production
call npm run build > webapp_build.log 2>&1
if errorlevel 1 (
    echo [ERROR] WebApp build failed
    echo         Check log: %WEBAPP_DIR%\webapp_build.log
    exit /b 1
)

REM Start WebApp preview server
echo [*] Starting WebApp on port %WEBAPP_PORT%...
start /B "" npm run preview -- --port %WEBAPP_PORT% --host 0.0.0.0 > webapp.log 2>&1

timeout /t 3 /nobreak >nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%WEBAPP_PORT%" ^| findstr "LISTENING"') do (
    echo [OK] WebApp started (PID: %%a)
    echo %%a > "%PROJECT_DIR%\webapp.pid"
    goto webapp_started
)
echo [WARNING] WebApp might still be starting...
echo          Check log: %WEBAPP_DIR%\webapp.log
:webapp_started

echo.

REM Start Dashboard
echo ========================================
echo   Starting Dashboard
echo ========================================
cd /d "%DASHBOARD_DIR%"

REM Build Dashboard
echo [*] Building Dashboard...
set NODE_ENV=production
call npm run build > dashboard_build.log 2>&1
if errorlevel 1 (
    echo [ERROR] Dashboard build failed
    echo         Check log: %DASHBOARD_DIR%\dashboard_build.log
    exit /b 1
)

REM Start Dashboard preview server
echo [*] Starting Dashboard on port %DASHBOARD_PORT%...
start /B "" npm run preview -- --port %DASHBOARD_PORT% --host 0.0.0.0 > dashboard.log 2>&1

timeout /t 3 /nobreak >nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%DASHBOARD_PORT%" ^| findstr "LISTENING"') do (
    echo [OK] Dashboard started (PID: %%a)
    echo %%a > "%PROJECT_DIR%\dashboard.pid"
    goto dashboard_started
)
echo [WARNING] Dashboard might still be starting...
echo          Check log: %DASHBOARD_DIR%\dashboard.log
:dashboard_started

echo.
echo ========================================
echo   Production Startup Complete!
echo ========================================
echo.
echo Services:
echo   Backend API:    http://localhost:%BACKEND_PORT%/api/
echo   Admin Panel:    http://localhost:%BACKEND_PORT%/admin/
echo   WebApp:         http://localhost:%WEBAPP_PORT%/
echo   Dashboard:      http://localhost:%DASHBOARD_PORT%/
echo.
echo Logs:
echo   Backend:        %BACKEND_DIR%\logs\gunicorn.log
echo   Telegram Bot:   %TELEGRAM_BOT_DIR%\logs\telegram_bot.log
echo   WebApp:         %WEBAPP_DIR%\webapp.log
echo   Dashboard:      %DASHBOARD_DIR%\dashboard.log
echo.
echo To stop services:
echo   stop_production.bat
echo   or
echo   taskkill /F /PID ^<PID^> (for each service)
echo.
pause

