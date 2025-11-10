# Deployment Guide

## Telegram Bot Webhook Setup

### 1. Server Configuration

#### Requirements:
- Ubuntu 20.04+ yoki boshqa Linux distribution
- Python 3.11+
- Nginx
- SSL sertifikat (Let's Encrypt)
- Domain name

### 2. SSL Certificate (HTTPS)

```bash
# Certbot o'rnatish
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# SSL sertifikat olish
sudo certbot --nginx -d yourdomain.com

# Avtomatik yangilanish
sudo certbot renew --dry-run
```

### 3. Nginx Configuration

`/etc/nginx/sites-available/telegram-bot`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Webhook endpoint
    location /webhook {
        proxy_pass http://127.0.0.1:8443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebApp (Frontend)
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/telegram-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Systemd Service

`/etc/systemd/system/telegram-bot.service`:

```ini
[Unit]
Description=Telegram Bot Webhook Service
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/your/project/telegram_bot
Environment="PATH=/path/to/your/project/telegram_bot/venv/bin"
ExecStart=/path/to/your/project/telegram_bot/venv/bin/python webhook.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable telegram-bot
sudo systemctl start telegram-bot
sudo systemctl status telegram-bot
```

### 5. Environment Variables

`.env` fayl:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
WEBHOOK_HOST=https://yourdomain.com
WEBHOOK_PATH=/webhook
WEBAPP_HOST=0.0.0.0
WEBAPP_PORT=8443

# Backend API
API_BASE_URL=https://yourdomain.com/api
TELEGRAM_WEBAPP_URL=https://yourdomain.com
```

### 6. Webhook Setup

Bot kodida webhook'ni o'rnatish:

```python
# webhook.py faylida avtomatik o'rnatiladi
```

Yoki qo'lda:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourdomain.com/webhook"}'
```

### 7. Verification

Webhook holatini tekshirish:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### 8. Logs

Loglarni ko'rish:

```bash
sudo journalctl -u telegram-bot -f
```

## Development Mode

Development uchun polling ishlatish:

```bash
cd telegram_bot
python bot.py
```

## Production Checklist

- [ ] SSL sertifikat o'rnatilgan
- [ ] Nginx konfiguratsiyasi to'g'ri
- [ ] Systemd service ishlamoqda
- [ ] Webhook o'rnatilgan
- [ ] Environment variables to'ldirilgan
- [ ] Loglar tekshirilgan
- [ ] Bot testdan o'tkazilgan

