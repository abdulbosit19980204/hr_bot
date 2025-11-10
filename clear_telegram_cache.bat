@echo off
REM Telegram cache'larni tozalash
REM Windows CMD uchun

echo 🧹 Telegram cache'larni tozalash...
echo.

REM Redis cache'larni tozalash
where redis-cli >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo ⏹️  Redis cache'larni tozalash...
    redis-cli FLUSHALL
    if %ERRORLEVEL% == 0 (
        echo ✅ Redis cache tozalandi
    ) else (
        echo ⚠️  Redis ishlamayapti yoki cache bo'sh
    )
) else (
    echo ⚠️  Redis o'rnatilmagan
)

REM Telegram Bot state fayllarini tozalash (agar MemoryStorage ishlatilsa)
if exist "telegram_bot" (
    echo ⏹️  Telegram Bot state fayllarini tozalash...
    del /s /q telegram_bot\*.state >nul 2>&1
    del /s /q telegram_bot\*.cache >nul 2>&1
    echo ✅ Telegram Bot state fayllari tozalandi
)

REM Log fayllarini tozalash (ixtiyoriy)
set /p response="Log fayllarni ham tozalashni xohlaysizmi? (y/n): "
if /i "%response%"=="y" (
    if exist "logs" (
        echo ⏹️  Log fayllarni tozalash...
        del /q logs\*.log >nul 2>&1
        echo ✅ Log fayllar tozalandi
    )
)

echo.
echo ✅ Telegram cache'lar tozalandi!
pause

