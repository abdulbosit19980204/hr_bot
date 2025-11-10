# HR Bot - Barcha servislarni qayta ishga tushirish va Telegram cache'larni tozalash
# Windows PowerShell uchun

Write-Host "🔄 HR Bot servislarini qayta ishga tushirish..." -ForegroundColor Yellow
Write-Host ""

# Funksiya: Process topish va o'ldirish
function Stop-ProcessByPort {
    param(
        [int]$Port,
        [string]$Name
    )
    
    Write-Host "⏹️  $Name ni to'xtatish (port $Port)..." -ForegroundColor Yellow
    
    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($process) {
        foreach ($pid in $process) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "✅ $Name to'xtatildi (PID: $pid)" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠️  $Name ishlamayapti" -ForegroundColor Yellow
    }
}

# Funksiya: Process ishlayotganini tekshirish
function Test-ProcessByPort {
    param(
        [int]$Port,
        [string]$Name
    )
    
    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($process) {
        Write-Host "✅ $Name ishlayapti (PID: $process, Port: $Port)" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ $Name ishlamayapti" -ForegroundColor Red
        return $false
    }
}

# Logs papkasini yaratish
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

# 1. Barcha servislarni to'xtatish
Write-Host "📋 Barcha servislarni to'xtatish..." -ForegroundColor Yellow
Write-Host ""

# Backend (Django) - port 8000
Stop-ProcessByPort -Port 8000 -Name "Backend (Django)"

# WebApp (Vite) - port 5173
Stop-ProcessByPort -Port 5173 -Name "WebApp (Vite)"

# Dashboard (Vite) - port 3000
Stop-ProcessByPort -Port 3000 -Name "Dashboard (Vite)"

# Telegram Bot
Write-Host "⏹️  Telegram Bot ni to'xtatish..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -eq "python" -or $_.ProcessName -eq "pythonw" } | 
    Where-Object { $_.CommandLine -like "*bot.py*" } | 
    Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "✅ Telegram Bot to'xtatildi" -ForegroundColor Green

# Redis (agar ishlatilsa)
Write-Host "⏹️  Redis cache'larni tozalash..." -ForegroundColor Yellow
if (Get-Command redis-cli -ErrorAction SilentlyContinue) {
    redis-cli FLUSHALL 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Redis cache tozalandi" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Redis ishlamayapti yoki cache bo'sh" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Redis o'rnatilmagan" -ForegroundColor Yellow
}

# 2. Kichik kutish
Write-Host ""
Write-Host "⏳ 3 soniya kutish..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 3. Barcha servislarni qayta ishga tushirish
Write-Host ""
Write-Host "🚀 Barcha servislarni qayta ishga tushirish..." -ForegroundColor Yellow
Write-Host ""

# Backend (Django)
Write-Host "▶️  Backend (Django) ni ishga tushirish..." -ForegroundColor Yellow
Set-Location backend
if (Test-Path "venv\Scripts\Activate.ps1") {
    & .\venv\Scripts\Activate.ps1
}
$backendJob = Start-Process -FilePath "python" -ArgumentList "manage.py", "runserver", "0.0.0.0:8000" -PassThru -WindowStyle Hidden -RedirectStandardOutput "..\logs\backend.log" -RedirectStandardError "..\logs\backend_error.log"
$backendJob.Id | Out-File -FilePath "..\logs\backend.pid" -Encoding ASCII
Set-Location ..
Start-Sleep -Seconds 2
Test-ProcessByPort -Port 8000 -Name "Backend (Django)"

# WebApp (Vite)
Write-Host "▶️  WebApp (Vite) ni ishga tushirish..." -ForegroundColor Yellow
Set-Location webapp
$webappJob = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru -WindowStyle Hidden -RedirectStandardOutput "..\logs\webapp.log" -RedirectStandardError "..\logs\webapp_error.log"
$webappJob.Id | Out-File -FilePath "..\logs\webapp.pid" -Encoding ASCII
Set-Location ..
Start-Sleep -Seconds 2
Test-ProcessByPort -Port 5173 -Name "WebApp (Vite)"

# Dashboard (Vite)
Write-Host "▶️  Dashboard (Vite) ni ishga tushirish..." -ForegroundColor Yellow
Set-Location dashboard
$dashboardJob = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru -WindowStyle Hidden -RedirectStandardOutput "..\logs\dashboard.log" -RedirectStandardError "..\logs\dashboard_error.log"
$dashboardJob.Id | Out-File -FilePath "..\logs\dashboard.pid" -Encoding ASCII
Set-Location ..
Start-Sleep -Seconds 2
Test-ProcessByPort -Port 3000 -Name "Dashboard (Vite)"

# Telegram Bot
Write-Host "▶️  Telegram Bot ni ishga tushirish..." -ForegroundColor Yellow
Set-Location telegram_bot
if (Test-Path "venv\Scripts\Activate.ps1") {
    & .\venv\Scripts\Activate.ps1
}
$botJob = Start-Process -FilePath "python" -ArgumentList "bot.py" -PassThru -WindowStyle Hidden -RedirectStandardOutput "..\logs\telegram_bot.log" -RedirectStandardError "..\logs\telegram_bot_error.log"
$botJob.Id | Out-File -FilePath "..\logs\telegram_bot.pid" -Encoding ASCII
Set-Location ..
Start-Sleep -Seconds 2

# Telegram Bot ishlayotganini tekshirish
if (Get-Process -Id $botJob.Id -ErrorAction SilentlyContinue) {
    Write-Host "✅ Telegram Bot ishlayapti (PID: $($botJob.Id))" -ForegroundColor Green
} else {
    Write-Host "❌ Telegram Bot ishga tushmadi" -ForegroundColor Red
}

# 4. Natijalar
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ Barcha servislar qayta ishga tushirildi!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Servislar holati:" -ForegroundColor Yellow
Write-Host ""
Test-ProcessByPort -Port 8000 -Name "Backend (Django)"
Test-ProcessByPort -Port 5173 -Name "WebApp (Vite)"
Test-ProcessByPort -Port 3000 -Name "Dashboard (Vite)"
if (Get-Process -Id $botJob.Id -ErrorAction SilentlyContinue) {
    Write-Host "✅ Telegram Bot ishlayapti (PID: $($botJob.Id))" -ForegroundColor Green
} else {
    Write-Host "❌ Telegram Bot ishlamayapti" -ForegroundColor Red
}
Write-Host ""
Write-Host "📝 Log fayllar:" -ForegroundColor Yellow
Write-Host "  - Backend: logs\backend.log"
Write-Host "  - WebApp: logs\webapp.log"
Write-Host "  - Dashboard: logs\dashboard.log"
Write-Host "  - Telegram Bot: logs\telegram_bot.log"
Write-Host ""
Write-Host "🎉 Tugadi!" -ForegroundColor Green

