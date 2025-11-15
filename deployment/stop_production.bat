@echo off
REM HR Bot Production Stop Script for Windows
REM This script stops all production services

setlocal enabledelayedexpansion

REM Project directory
if "%PROJECT_DIR%"=="" set PROJECT_DIR=%~dp0..

echo.
echo ========================================
echo   Stopping HR Bot Production Services
echo ========================================
echo.

REM Function to kill process by PID file
:kill_by_pid_file
setlocal enabledelayedexpansion
set "pid_file=%~1"
set "service_name=%~2"

if exist "!pid_file!" (
    set /p pid=<"!pid_file!"
    set "pid=!pid: =!"
    if "!pid!"=="" (
        echo [WARNING] PID file is empty for !service_name!
        del "!pid_file!" >nul 2>&1
    ) else (
        tasklist /FI "PID eq !pid!" 2>nul | find /I "!pid!" >nul
        if errorlevel 1 (
            echo [WARNING] !service_name! process not found (PID: !pid!)
            del "!pid_file!" >nul 2>&1
        ) else (
            echo [*] Stopping !service_name! (PID: !pid!)...
            taskkill /F /PID !pid! >nul 2>&1
            del "!pid_file!" >nul 2>&1
            echo [OK] !service_name! stopped
        )
    )
) else (
    echo [WARNING] PID file not found for !service_name!
)
endlocal
exit /b 0

REM Stop services by PID files
call :kill_by_pid_file "%PROJECT_DIR%\backend.pid" "Backend"
call :kill_by_pid_file "%PROJECT_DIR%\telegram_bot.pid" "Telegram Bot"
call :kill_by_pid_file "%PROJECT_DIR%\webapp.pid" "WebApp"
call :kill_by_pid_file "%PROJECT_DIR%\dashboard.pid" "Dashboard"

REM Also kill by process name (in case PID files are missing)
echo [*] Cleaning up remaining processes...

REM Kill backend processes (Gunicorn)
taskkill /F /FI "WINDOWTITLE eq *gunicorn*" >nul 2>&1
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO CSV 2^>nul ^| findstr /i "gunicorn"') do (
    set PID=%%a
    set PID=!PID:"=!
    if not "!PID!"=="" taskkill /F /PID !PID! >nul 2>&1
)

REM Kill telegram bot processes
taskkill /F /FI "WINDOWTITLE eq *bot.py*" >nul 2>&1
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO CSV 2^>nul ^| findstr /i "bot.py"') do (
    set PID=%%a
    set PID=!PID:"=!
    if not "!PID!"=="" taskkill /F /PID !PID! >nul 2>&1
)

REM Kill Node.js processes (webapp and dashboard)
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV 2^>nul') do (
    set PID=%%a
    set PID=!PID:"=!
    if not "!PID!"=="" taskkill /F /PID !PID! >nul 2>&1
)

REM Kill processes on ports
echo [*] Killing processes on ports...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [OK] All services stopped
echo.
pause

