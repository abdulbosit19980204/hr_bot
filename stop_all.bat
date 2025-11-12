@echo off
echo ========================================
echo HR Bot - Stop All Services
echo ========================================
echo.

echo [1/4] Stopping Ngrok...
taskkill /F /IM ngrok.exe >nul 2>&1

echo [2/4] Stopping Nginx...
taskkill /F /IM nginx.exe >nul 2>&1

echo [3/4] Stopping Backend...
taskkill /F /FI "WINDOWTITLE eq HR Bot - Backend*" >nul 2>&1
for /f "tokens=2" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [4/4] Stopping WebApp...
taskkill /F /FI "WINDOWTITLE eq HR Bot - WebApp*" >nul 2>&1
for /f "tokens=2" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ========================================
echo All services stopped!
echo ========================================
echo.
timeout /t 2 /nobreak >nul

