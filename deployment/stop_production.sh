#!/bin/bash

# HR Bot Production Stop Script
# This script stops all production services

set -e

# Project directory
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping HR Bot Production Services${NC}"

# Function to kill process by PID file
kill_by_pid_file() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}   Stopping $service_name (PID: $pid)...${NC}"
            kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
            rm -f "$pid_file"
            echo -e "${GREEN}✅ $service_name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name process not found (PID: $pid)${NC}"
            rm -f "$pid_file"
        fi
    else
        echo -e "${YELLOW}⚠️  PID file not found for $service_name${NC}"
    fi
}

# Stop services by PID files
kill_by_pid_file "$PROJECT_DIR/backend.pid" "Backend"
kill_by_pid_file "$PROJECT_DIR/telegram_bot.pid" "Telegram Bot"
kill_by_pid_file "$PROJECT_DIR/webapp.pid" "WebApp"
kill_by_pid_file "$PROJECT_DIR/dashboard.pid" "Dashboard"

# Also kill by process name (in case PID files are missing)
echo -e "${YELLOW}🔄 Cleaning up remaining processes...${NC}"

# Kill backend processes
pkill -f "gunicorn.*hr_bot" 2>/dev/null || true
pkill -f "gunicorn.*8000" 2>/dev/null || true

# Kill telegram bot processes
pkill -f "telegram_bot/bot.py" 2>/dev/null || true
pkill -f "python.*bot.py" 2>/dev/null || true

# Kill webapp processes
pkill -f "vite.*preview.*5173" 2>/dev/null || true
pkill -f "vite.*preview.*webapp" 2>/dev/null || true

# Kill dashboard processes
pkill -f "vite.*preview.*3000" 2>/dev/null || true
pkill -f "vite.*preview.*dashboard" 2>/dev/null || true

# Kill processes on ports
for port in 8000 5173 3000; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}   Killing process on port $port...${NC}"
        lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
    fi
done

echo -e "${GREEN}✅ All services stopped${NC}"

