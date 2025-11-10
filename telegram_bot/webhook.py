"""
Telegram Bot Webhook Handler
Production uchun webhook setup
"""
import os
import logging
from aiohttp import web
from aiogram import Bot, Dispatcher, types
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiogram.fsm.storage.memory import MemoryStorage
from dotenv import load_dotenv
import ssl

from bot import dp, bot

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Webhook configuration
WEBHOOK_HOST = os.getenv('WEBHOOK_HOST', 'https://yourdomain.com')
WEBHOOK_PATH = os.getenv('WEBHOOK_PATH', '/webhook')
WEBHOOK_URL = f"{WEBHOOK_HOST}{WEBHOOK_PATH}"

# Web server configuration
WEBAPP_HOST = os.getenv('WEBAPP_HOST', '0.0.0.0')
WEBAPP_PORT = int(os.getenv('WEBAPP_PORT', 8443))


async def on_startup(bot: Bot) -> None:
    """Webhook setup on startup"""
    # Set webhook
    await bot.set_webhook(
        url=WEBHOOK_URL,
        drop_pending_updates=True,
        allowed_updates=types.WebhookInfo.AllowedUpdatesType.ALL
    )
    logger.info(f"Webhook set to {WEBHOOK_URL}")


async def on_shutdown(bot: Bot) -> None:
    """Webhook cleanup on shutdown"""
    await bot.delete_webhook()
    logger.info("Webhook deleted")


def main():
    """Main function to run webhook server"""
    # Create application
    app = web.Application()
    
    # Setup webhook handler
    webhook_requests_handler = SimpleRequestHandler(
        dispatcher=dp,
        bot=bot,
    )
    webhook_requests_handler.register(app, path=WEBHOOK_PATH)
    
    # Setup application
    setup_application(app, dp, bot=bot)
    
    # SSL context (HTTPS uchun)
    # Production'da SSL sertifikatlarini qo'shing
    # context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    # context.load_cert_chain('/path/to/cert.pem', '/path/to/key.pem')
    
    # On startup
    app.on_startup.append(on_startup)
    app.on_shutdown.append(on_shutdown)
    
    # Run application
    # HTTPS uchun:
    # web.run_app(app, host=WEBAPP_HOST, port=WEBAPP_PORT, ssl_context=context)
    # HTTP uchun (development):
    web.run_app(app, host=WEBAPP_HOST, port=WEBAPP_PORT)
    
    logger.info(f"Webhook server started on {WEBAPP_HOST}:{WEBAPP_PORT}")


if __name__ == '__main__':
    main()

