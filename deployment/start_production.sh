#!/bin/bash

# HR Bot Production Start Script
# This script starts backend, telegram bot, webapp, and dashboard in production mode

set -e

# Project directory (adjust this to your actual path)
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
BACKEND_DIR="$PROJECT_DIR/backend"
TELEGRAM_BOT_DIR="$PROJECT_DIR/telegram_bot"
WEBAPP_DIR="$PROJECT_DIR/webapp"
DASHBOARD_DIR="$PROJECT_DIR/dashboard"

# Ports
BACKEND_PORT="${BACKEND_PORT:-8000}"
WEBAPP_PORT="${WEBAPP_PORT:-5173}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting HR Bot in Production Mode${NC}"

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $port is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $port is available${NC}"
        return 0
    fi
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    echo -e "${YELLOW}🔄 Killing processes on port $port...${NC}"
    lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Kill existing processes
echo -e "${YELLOW}🔄 Cleaning up existing processes...${NC}"

# Kill backend processes
echo -e "${YELLOW}   Stopping backend on port $BACKEND_PORT...${NC}"
pkill -f "gunicorn.*hr_bot" 2>/dev/null || true
pkill -f "gunicorn.*8000" 2>/dev/null || true
kill_port $BACKEND_PORT

# Kill telegram bot processes
echo -e "${YELLOW}   Stopping telegram bot...${NC}"
pkill -f "telegram_bot/bot.py" 2>/dev/null || true
pkill -f "python.*bot.py" 2>/dev/null || true

# Kill webapp processes
echo -e "${YELLOW}   Stopping webapp on port $WEBAPP_PORT...${NC}"
pkill -f "vite.*preview.*$WEBAPP_PORT" 2>/dev/null || true
pkill -f "vite.*5173" 2>/dev/null || true
kill_port $WEBAPP_PORT

# Kill dashboard processes
echo -e "${YELLOW}   Stopping dashboard on port $DASHBOARD_PORT...${NC}"
pkill -f "vite.*preview.*$DASHBOARD_PORT" 2>/dev/null || true
pkill -f "vite.*3000" 2>/dev/null || true
kill_port $DASHBOARD_PORT

# Wait to ensure ports are free
echo -e "${YELLOW}   Waiting for ports to be released...${NC}"
sleep 3

# Verify ports are free
for port in $BACKEND_PORT $WEBAPP_PORT $DASHBOARD_PORT; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}❌ Port $port still in use, forcing kill...${NC}"
        lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
done

echo -e "${GREEN}✅ All ports cleared${NC}"

# Start Backend
echo -e "${BLUE}🔧 Starting Django Backend...${NC}"
cd $BACKEND_DIR

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
else
    echo -e "${RED}❌ Virtual environment not found${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ] && [ ! -f "../.env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Please create one.${NC}"
fi

# Check if migrations are needed
echo -e "${YELLOW}📊 Checking migrations...${NC}"
python3 manage.py migrate --check 2>/dev/null || {
    echo -e "${YELLOW}📊 Running migrations...${NC}"
    python3 manage.py migrate
}

# Collect static files
echo -e "${YELLOW}📁 Collecting static files...${NC}"
python3 manage.py collectstatic --noinput

# Create logs directory if it doesn't exist
mkdir -p logs

# Start Gunicorn in background
echo -e "${GREEN}🚀 Starting Gunicorn on port $BACKEND_PORT...${NC}"

# Use gunicorn config if available, otherwise use command line args
if [ -f "$PROJECT_DIR/deployment/gunicorn_config.py" ]; then
    nohup gunicorn \
        --config $PROJECT_DIR/deployment/gunicorn_config.py \
        --bind 0.0.0.0:$BACKEND_PORT \
        hr_bot.wsgi:application > logs/gunicorn.log 2>&1 &
else
    nohup gunicorn \
        --bind 0.0.0.0:$BACKEND_PORT \
        --workers 3 \
        --timeout 120 \
        --keep-alive 2 \
        --max-requests 1000 \
        --max-requests-jitter 50 \
        --access-logfile logs/gunicorn_access.log \
        --error-logfile logs/gunicorn_error.log \
        hr_bot.wsgi:application > logs/gunicorn.log 2>&1 &
fi

BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started with PID: $BACKEND_PID${NC}"

# Wait for backend to start
echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
sleep 5

# Check if backend is running
if curl -s http://localhost:$BACKEND_PORT/api/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running on http://localhost:$BACKEND_PORT${NC}"
else
    echo -e "${YELLOW}⚠️  Backend might still be starting...${NC}"
    echo -e "${YELLOW}   Check logs: $BACKEND_DIR/logs/gunicorn.log${NC}"
fi

# Start Telegram Bot
echo -e "${BLUE}🤖 Starting Telegram Bot...${NC}"
cd $TELEGRAM_BOT_DIR

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
else
    echo -e "${RED}❌ Telegram bot virtual environment not found${NC}"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start telegram bot in background
echo -e "${GREEN}🚀 Starting Telegram Bot...${NC}"
nohup python3 bot.py > logs/telegram_bot.log 2>&1 &
TELEGRAM_BOT_PID=$!
echo -e "${GREEN}✅ Telegram Bot started with PID: $TELEGRAM_BOT_PID${NC}"

# Wait for telegram bot to start
echo -e "${YELLOW}⏳ Waiting for telegram bot to start...${NC}"
sleep 3

# Start WebApp
echo -e "${BLUE}🎨 Starting WebApp...${NC}"
cd $WEBAPP_DIR

# Load Node.js environment if NVM is available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Build WebApp
echo -e "${YELLOW}🧱 Building WebApp...${NC}"
export NODE_ENV=production
npm run build > webapp_build.log 2>&1 || {
    echo -e "${RED}❌ WebApp build failed${NC}"
    echo -e "${YELLOW}   Check log: $WEBAPP_DIR/webapp_build.log${NC}"
    exit 1
}

# Start WebApp preview server
echo -e "${GREEN}🚀 Starting WebApp on port $WEBAPP_PORT...${NC}"
nohup npm run preview -- --port $WEBAPP_PORT --host 0.0.0.0 > webapp.log 2>&1 &
WEBAPP_PID=$!
echo -e "${GREEN}✅ WebApp started with PID: $WEBAPP_PID${NC}"

# Wait for webapp to start
echo -e "${YELLOW}⏳ Waiting for webapp to start...${NC}"
sleep 5

# Check if webapp is running
if curl -s http://localhost:$WEBAPP_PORT/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ WebApp is running on http://localhost:$WEBAPP_PORT${NC}"
else
    echo -e "${YELLOW}⚠️  WebApp might still be starting...${NC}"
    echo -e "${YELLOW}   Check log: $WEBAPP_DIR/webapp.log${NC}"
fi

# Start Dashboard
echo -e "${BLUE}📊 Starting Dashboard...${NC}"
cd $DASHBOARD_DIR

# Build Dashboard
echo -e "${YELLOW}🧱 Building Dashboard...${NC}"
export NODE_ENV=production
npm run build > dashboard_build.log 2>&1 || {
    echo -e "${RED}❌ Dashboard build failed${NC}"
    echo -e "${YELLOW}   Check log: $DASHBOARD_DIR/dashboard_build.log${NC}"
    exit 1
}

# Start Dashboard preview server
echo -e "${GREEN}🚀 Starting Dashboard on port $DASHBOARD_PORT...${NC}"
nohup npm run preview -- --port $DASHBOARD_PORT --host 0.0.0.0 > dashboard.log 2>&1 &
DASHBOARD_PID=$!
echo -e "${GREEN}✅ Dashboard started with PID: $DASHBOARD_PID${NC}"

# Wait for dashboard to start
echo -e "${YELLOW}⏳ Waiting for dashboard to start...${NC}"
sleep 5

# Check if dashboard is running
if curl -s http://localhost:$DASHBOARD_PORT/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dashboard is running on http://localhost:$DASHBOARD_PORT${NC}"
else
    echo -e "${YELLOW}⚠️  Dashboard might still be starting...${NC}"
    echo -e "${YELLOW}   Check log: $DASHBOARD_DIR/dashboard.log${NC}"
fi

# Save PIDs to file
echo $BACKEND_PID > $PROJECT_DIR/backend.pid
echo $TELEGRAM_BOT_PID > $PROJECT_DIR/telegram_bot.pid
echo $WEBAPP_PID > $PROJECT_DIR/webapp.pid
echo $DASHBOARD_PID > $PROJECT_DIR/dashboard.pid

echo ""
echo -e "${GREEN}🎉 HR Bot is now running in production mode!${NC}"
echo ""
echo -e "${BLUE}📊 Services:${NC}"
echo -e "   Backend API:    http://localhost:$BACKEND_PORT/api/"
echo -e "   Admin Panel:    http://localhost:$BACKEND_PORT/admin/"
echo -e "   WebApp:         http://localhost:$WEBAPP_PORT/"
echo -e "   Dashboard:      http://localhost:$DASHBOARD_PORT/"
echo ""
echo -e "${YELLOW}📝 Logs:${NC}"
echo -e "   Backend:        $BACKEND_DIR/logs/gunicorn.log"
echo -e "   Telegram Bot:   $TELEGRAM_BOT_DIR/logs/telegram_bot.log"
echo -e "   WebApp:         $WEBAPP_DIR/webapp.log"
echo -e "   Dashboard:     $DASHBOARD_DIR/dashboard.log"
echo ""
echo -e "${YELLOW}🛑 To stop services:${NC}"
echo -e "   ./stop_production.sh"
echo -e "   or"
echo -e "   kill \$(cat backend.pid) \$(cat telegram_bot.pid) \$(cat webapp.pid) \$(cat dashboard.pid)"
echo ""
echo -e "${GREEN}✅ Production startup completed successfully!${NC}"

