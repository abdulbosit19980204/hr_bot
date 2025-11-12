#!/bin/bash

# HR Bot Production Deployment Script
# Server: e-catalog@192.168.0.28
# Production URL: http://178.218.200.120:8523

set -e  # Exit on error

echo "🚀 HR Bot Production Deployment Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/e-catalog/hr_bot"
BACKEND_DIR="$PROJECT_DIR/backend"
TELEGRAM_BOT_DIR="$PROJECT_DIR/telegram_bot"
WEBAPP_DIR="$PROJECT_DIR/webapp"
DASHBOARD_DIR="$PROJECT_DIR/dashboard"
GIT_REPO="https://github.com/abdulbosit19980204/hr_bot.git"

# Check if running as correct user
if [ "$USER" != "e-catalog" ]; then
    echo -e "${YELLOW}Warning: Running as $USER, expected e-catalog${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 1: Create project directory if it doesn't exist
echo -e "\n${GREEN}Step 1: Setting up project directory...${NC}"
if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p "$PROJECT_DIR"
    echo "Created project directory: $PROJECT_DIR"
else
    echo "Project directory exists: $PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# Step 2: Clone or update repository
echo -e "\n${GREEN}Step 2: Cloning/Updating repository...${NC}"
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo "Cloning repository..."
    git clone "$GIT_REPO" .
else
    echo "Updating repository..."
    git pull origin main
fi

# Step 3: Create necessary directories
echo -e "\n${GREEN}Step 3: Creating necessary directories...${NC}"
mkdir -p /var/log/hr_bot
mkdir -p /var/run/hr_bot
mkdir -p "$BACKEND_DIR/static"
mkdir -p "$BACKEND_DIR/media"
mkdir -p "$BACKEND_DIR/logs"
mkdir -p "$TELEGRAM_BOT_DIR/logs"

# Set permissions
chown -R e-catalog:e-catalog /var/log/hr_bot
chown -R e-catalog:e-catalog /var/run/hr_bot
chown -R e-catalog:e-catalog "$PROJECT_DIR"

# Step 4: Setup Backend
echo -e "\n${GREEN}Step 4: Setting up Backend...${NC}"
cd "$BACKEND_DIR"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo "Installing backend dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file for backend...${NC}"
    cat > .env << EOF
DEBUG=False
SECRET_KEY=$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
ALLOWED_HOSTS=178.218.200.120,localhost,127.0.0.1
USE_POSTGRES=True
DB_NAME=hr_bot_db
DB_USER=hr_bot_user
DB_PASSWORD=CHANGE_THIS_PASSWORD
DB_HOST=localhost
DB_PORT=5432
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
TELEGRAM_WEBAPP_URL=http://178.218.200.120:8523/webapp
CORS_ALLOWED_ORIGINS=http://178.218.200.120:8523,https://178.218.200.120:8523
EOF
    echo -e "${RED}⚠️  IMPORTANT: Edit $BACKEND_DIR/.env and set correct values!${NC}"
else
    echo ".env file already exists"
fi

# Run migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Step 5: Setup Telegram Bot
echo -e "\n${GREEN}Step 5: Setting up Telegram Bot...${NC}"
cd "$TELEGRAM_BOT_DIR"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo "Installing telegram bot dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file for telegram bot...${NC}"
    cat > .env << EOF
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
API_BASE_URL=http://127.0.0.1:8000/api
TELEGRAM_WEBAPP_URL=http://178.218.200.120:8523/webapp
ADMIN_CHAT_ID=YOUR_ADMIN_CHAT_ID
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
EOF
    echo -e "${RED}⚠️  IMPORTANT: Edit $TELEGRAM_BOT_DIR/.env and set correct values!${NC}"
else
    echo ".env file already exists"
fi

# Step 6: Setup WebApp (if needed)
echo -e "\n${GREEN}Step 6: Setting up WebApp...${NC}"
cd "$WEBAPP_DIR"

if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        echo "Installing WebApp dependencies..."
        npm install
    fi
    
    # Build WebApp
    echo "Building WebApp..."
    npm run build
else
    echo "WebApp package.json not found, skipping..."
fi

# Step 7: Setup Dashboard (if needed)
echo -e "\n${GREEN}Step 7: Setting up Dashboard...${NC}"
cd "$DASHBOARD_DIR"

if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        echo "Installing Dashboard dependencies..."
        npm install
    fi
    
    # Build Dashboard
    echo "Building Dashboard..."
    npm run build
else
    echo "Dashboard package.json not found, skipping..."
fi

# Step 8: Install and configure systemd services
echo -e "\n${GREEN}Step 8: Installing systemd services...${NC}"
cd "$PROJECT_DIR"

# Copy service files
sudo cp deployment/hr-bot-backend.service /etc/systemd/system/
sudo cp deployment/hr-bot-telegram.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable hr-bot-backend.service
sudo systemctl enable hr-bot-telegram.service

echo -e "${GREEN}Systemd services installed and enabled${NC}"

# Step 9: Setup Nginx
echo -e "\n${GREEN}Step 9: Setting up Nginx...${NC}"

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo apt update
    sudo apt install -y nginx
fi

# Copy Nginx configuration
sudo cp deployment/nginx_hr_bot.conf /etc/nginx/sites-available/hr_bot
sudo ln -sf /etc/nginx/sites-available/hr_bot /etc/nginx/sites-enabled/

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Step 10: Final instructions
echo -e "\n${GREEN}======================================"
echo "Deployment completed successfully!"
echo "======================================${NC}\n"

echo -e "${YELLOW}⚠️  IMPORTANT: Before starting services, please:${NC}"
echo "1. Edit $BACKEND_DIR/.env and set all required values"
echo "2. Edit $TELEGRAM_BOT_DIR/.env and set all required values"
echo "3. Create PostgreSQL database and user:"
echo "   sudo -u postgres psql"
echo "   CREATE DATABASE hr_bot_db;"
echo "   CREATE USER hr_bot_user WITH PASSWORD 'your_password';"
echo "   GRANT ALL PRIVILEGES ON DATABASE hr_bot_db TO hr_bot_user;"
echo "   \\q"
echo ""
echo -e "${GREEN}To start services:${NC}"
echo "  sudo systemctl start hr-bot-backend"
echo "  sudo systemctl start hr-bot-telegram"
echo "  sudo systemctl reload nginx"
echo ""
echo -e "${GREEN}To check service status:${NC}"
echo "  sudo systemctl status hr-bot-backend"
echo "  sudo systemctl status hr-bot-telegram"
echo "  sudo systemctl status nginx"
echo ""
echo -e "${GREEN}To view logs:${NC}"
echo "  sudo journalctl -u hr-bot-backend -f"
echo "  sudo journalctl -u hr-bot-telegram -f"
echo "  tail -f /var/log/hr_bot/gunicorn_error.log"
echo ""
echo -e "${GREEN}Production URL: http://178.218.200.120:8523${NC}"

