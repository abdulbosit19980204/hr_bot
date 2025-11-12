#!/bin/bash

echo "========================================"
echo "HR Bot - Ngrok Setup (Variant 2)"
echo "========================================"
echo ""

# Check if Nginx is running
if pgrep -x "nginx" > /dev/null; then
    echo "[INFO] Nginx is already running"
else
    echo "[INFO] Starting Nginx..."
    sudo nginx -c "$(dirname "$0")/nginx/nginx.local.conf"
    sleep 2
fi

# Check if Backend is running on port 8000
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "[INFO] Backend is running on port 8000"
else
    echo "[WARNING] Backend is not running on port 8000"
    echo "[WARNING] Please start backend: cd backend && python manage.py runserver 0.0.0.0:8000"
fi

# Check if WebApp is running on port 5173
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "[INFO] WebApp is running on port 5173"
else
    echo "[WARNING] WebApp is not running on port 5173"
    echo "[WARNING] Please start webapp: cd webapp && npm run dev"
fi

echo ""
echo "[INFO] Starting Ngrok on port 8080..."
echo "[INFO] Ngrok will expose Nginx (which proxies Backend and WebApp)"
echo ""
ngrok http 8080

echo ""
echo "========================================"
echo "Done! Check Ngrok URL above."
echo "========================================"

