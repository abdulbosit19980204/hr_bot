#!/bin/bash

# HR Bot - Barcha servislarni qayta ishga tushirish va Telegram cache'larni tozalash
# Ubuntu/Linux uchun

echo "🔄 HR Bot servislarini qayta ishga tushirish..."
echo ""

# Ranglar
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funksiya: Process topish va o'ldirish
kill_process() {
    local port=$1
    local name=$2
    
    echo -e "${YELLOW}⏹️  $name ni to'xtatish (port $port)...${NC}"
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        kill -9 $PID 2>/dev/null
        echo -e "${GREEN}✅ $name to'xtatildi${NC}"
    else
        echo -e "${YELLOW}⚠️  $name ishlamayapti${NC}"
    fi
}

# Funksiya: Process ishlayotganini tekshirish
check_process() {
    local port=$1
    local name=$2
    
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo -e "${GREEN}✅ $name ishlayapti (PID: $PID, Port: $port)${NC}"
        return 0
    else
        echo -e "${RED}❌ $name ishlamayapti${NC}"
        return 1
    fi
}

# 1. Barcha servislarni to'xtatish
echo -e "${YELLOW}📋 Barcha servislarni to'xtatish...${NC}"
echo ""

# Backend (Django) - port 8000
kill_process 8000 "Backend (Django)"

# WebApp (Vite) - port 5173
kill_process 5173 "WebApp (Vite)"

# Dashboard (Vite) - port 3000
kill_process 3000 "Dashboard (Vite)"

# Telegram Bot
echo -e "${YELLOW}⏹️  Telegram Bot ni to'xtatish...${NC}"
pkill -f "python.*bot.py" 2>/dev/null
pkill -f "python3.*bot.py" 2>/dev/null
echo -e "${GREEN}✅ Telegram Bot to'xtatildi${NC}"

# Redis (agar ishlatilsa)
echo -e "${YELLOW}⏹️  Redis cache'larni tozalash...${NC}"
if command -v redis-cli &> /dev/null; then
    redis-cli FLUSHALL 2>/dev/null && echo -e "${GREEN}✅ Redis cache tozalandi${NC}" || echo -e "${YELLOW}⚠️  Redis ishlamayapti yoki cache bo'sh${NC}"
else
    echo -e "${YELLOW}⚠️  Redis o'rnatilmagan${NC}"
fi

# 2. Kichik kutish
echo ""
echo -e "${YELLOW}⏳ 3 soniya kutish...${NC}"
sleep 3

# 3. Barcha servislarni qayta ishga tushirish
echo ""
echo -e "${YELLOW}🚀 Barcha servislarni qayta ishga tushirish...${NC}"
echo ""

# Backend (Django)
echo -e "${YELLOW}▶️  Backend (Django) ni ishga tushirish...${NC}"
cd backend
if [ -d "venv" ]; then
    source venv/bin/activate
fi
nohup python manage.py runserver 0.0.0.0:8000 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend.pid
cd ..
sleep 2
check_process 8000 "Backend (Django)"

# WebApp (Vite)
echo -e "${YELLOW}▶️  WebApp (Vite) ni ishga tushirish...${NC}"
cd webapp
nohup npm run dev > ../logs/webapp.log 2>&1 &
WEBAPP_PID=$!
echo $WEBAPP_PID > ../logs/webapp.pid
cd ..
sleep 2
check_process 5173 "WebApp (Vite)"

# Dashboard (Vite)
echo -e "${YELLOW}▶️  Dashboard (Vite) ni ishga tushirish...${NC}"
cd dashboard
nohup npm run dev > ../logs/dashboard.log 2>&1 &
DASHBOARD_PID=$!
echo $DASHBOARD_PID > ../logs/dashboard.pid
cd ..
sleep 2
check_process 3000 "Dashboard (Vite)"

# Telegram Bot
echo -e "${YELLOW}▶️  Telegram Bot ni ishga tushirish...${NC}"
cd telegram_bot
if [ -d "venv" ]; then
    source venv/bin/activate
fi
nohup python bot.py > ../logs/telegram_bot.log 2>&1 &
BOT_PID=$!
echo $BOT_PID > ../logs/telegram_bot.pid
cd ..
sleep 2

# Telegram Bot ishlayotganini tekshirish
if ps -p $BOT_PID > /dev/null; then
    echo -e "${GREEN}✅ Telegram Bot ishlayapti (PID: $BOT_PID)${NC}"
else
    echo -e "${RED}❌ Telegram Bot ishga tushmadi${NC}"
fi

# 4. Natijalar
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Barcha servislar qayta ishga tushirildi!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📊 Servislar holati:${NC}"
echo ""
check_process 8000 "Backend (Django)"
check_process 5173 "WebApp (Vite)"
check_process 3000 "Dashboard (Vite)"
if ps -p $BOT_PID > /dev/null; then
    echo -e "${GREEN}✅ Telegram Bot ishlayapti (PID: $BOT_PID)${NC}"
else
    echo -e "${RED}❌ Telegram Bot ishlamayapti${NC}"
fi
echo ""
echo -e "${YELLOW}📝 Log fayllar:${NC}"
echo "  - Backend: logs/backend.log"
echo "  - WebApp: logs/webapp.log"
echo "  - Dashboard: logs/dashboard.log"
echo "  - Telegram Bot: logs/telegram_bot.log"
echo ""
echo -e "${GREEN}🎉 Tugadi!${NC}"

