# Telegram cache'larni tozalash
# Windows PowerShell uchun

Write-Host "🧹 Telegram cache'larni tozalash..." -ForegroundColor Yellow
Write-Host ""

# Redis cache'larni tozalash
if (Get-Command redis-cli -ErrorAction SilentlyContinue) {
    Write-Host "⏹️  Redis cache'larni tozalash..." -ForegroundColor Yellow
    redis-cli FLUSHALL
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Redis cache tozalandi" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Redis ishlamayapti yoki cache bo'sh" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Redis o'rnatilmagan" -ForegroundColor Yellow
}

# Telegram Bot state fayllarini tozalash (agar MemoryStorage ishlatilsa)
if (Test-Path "telegram_bot") {
    Write-Host "⏹️  Telegram Bot state fayllarini tozalash..." -ForegroundColor Yellow
    Get-ChildItem -Path "telegram_bot" -Recurse -Filter "*.state" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path "telegram_bot" -Recurse -Filter "*.cache" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Telegram Bot state fayllari tozalandi" -ForegroundColor Green
}

# Log fayllarini tozalash (ixtiyoriy)
$response = Read-Host "Log fayllarni ham tozalashni xohlaysizmi? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    if (Test-Path "logs") {
        Write-Host "⏹️  Log fayllarni tozalash..." -ForegroundColor Yellow
        Get-ChildItem -Path "logs" -Filter "*.log" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
        Write-Host "✅ Log fayllar tozalandi" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ Telegram cache'lar tozalandi!" -ForegroundColor Green

