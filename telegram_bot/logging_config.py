"""Logging configuration for Telegram bot"""
import os
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Get bot directory
BOT_DIR = Path(__file__).resolve().parent

# Create logs directory if it doesn't exist
logs_dir = BOT_DIR / 'logs'
if not logs_dir.exists():
    os.makedirs(logs_dir)

def setup_logging():
    """Setup logging configuration for Telegram bot"""
    # Create formatters
    verbose_formatter = logging.Formatter(
        '%(levelname)s %(asctime)s %(name)s %(process)d %(thread)d %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    simple_formatter = logging.Formatter(
        '%(levelname)s %(asctime)s %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # File handler - rotating file handler
    file_handler = RotatingFileHandler(
        logs_dir / 'telegram_bot.log',
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(verbose_formatter)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(simple_formatter)
    
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    # Specific loggers
    aiogram_logger = logging.getLogger('aiogram')
    aiogram_logger.setLevel(logging.WARNING)  # Reduce aiogram verbosity
    
    return root_logger

