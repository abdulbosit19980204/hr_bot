"""
Services for sending notifications via Telegram bot
"""
import os
import logging
import aiohttp
import asyncio
from django.conf import settings
from django.utils.html import strip_tags
import re

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = getattr(settings, 'TELEGRAM_BOT_TOKEN', os.getenv('TELEGRAM_BOT_TOKEN', ''))


def html_to_telegram_html(html_text):
    """
    Convert HTML to Telegram HTML format
    Telegram supports: <b>bold</b>, <i>italic</i>, <u>underline</u>, <s>strikethrough</s>,
    <a href="URL">inline URL</a>, <code>inline fixed-width code</code>, <pre>pre-formatted fixed-width code block</pre>
    """
    if not html_text:
        return ""
    
    # Remove unsupported tags and convert to Telegram format
    # Replace <strong> and <b> with <b>
    html_text = re.sub(r'<(strong|b)>', '<b>', html_text, flags=re.IGNORECASE)
    html_text = re.sub(r'</(strong|b)>', '</b>', html_text, flags=re.IGNORECASE)
    
    # Replace <em> and <i> with <i>
    html_text = re.sub(r'<(em|i)>', '<i>', html_text, flags=re.IGNORECASE)
    html_text = re.sub(r'</(em|i)>', '</i>', html_text, flags=re.IGNORECASE)
    
    # Keep <u> for underline
    html_text = re.sub(r'<u>', '<u>', html_text, flags=re.IGNORECASE)
    html_text = re.sub(r'</u>', '</u>', html_text, flags=re.IGNORECASE)
    
    # Keep <s> for strikethrough
    html_text = re.sub(r'<s>', '<s>', html_text, flags=re.IGNORECASE)
    html_text = re.sub(r'</s>', '</s>', html_text, flags=re.IGNORECASE)
    
    # Keep <code> for inline code
    html_text = re.sub(r'<code>', '<code>', html_text, flags=re.IGNORECASE)
    html_text = re.sub(r'</code>', '</code>', html_text, flags=re.IGNORECASE)
    
    # Keep <pre> for code blocks
    html_text = re.sub(r'<pre>', '<pre>', html_text, flags=re.IGNORECASE)
    html_text = re.sub(r'</pre>', '</pre>', html_text, flags=re.IGNORECASE)
    
    # Convert <a href="..."> to Telegram format
    html_text = re.sub(r'<a\s+href=["\']([^"\']+)["\']>([^<]+)</a>', r'<a href="\1">\2</a>', html_text, flags=re.IGNORECASE)
    
    # Remove unsupported tags (like <p>, <div>, <br>, etc.) but keep their content
    html_text = re.sub(r'</?(p|div|span|br|h[1-6]|ul|ol|li)[^>]*>', '\n', html_text, flags=re.IGNORECASE)
    
    # Clean up multiple newlines
    html_text = re.sub(r'\n{3,}', '\n\n', html_text)
    
    return html_text.strip()


async def send_telegram_message_async(telegram_id, message_text, parse_mode='HTML'):
    """
    Send message to Telegram user asynchronously
    """
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN is not set")
        return False
    
    if not telegram_id:
        logger.warning(f"Invalid telegram_id: {telegram_id}")
        return False
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    
    # Limit message length (Telegram allows max 4096 chars)
    if len(message_text) > 4000:
        message_text = message_text[:4000] + "... (xabar qisqartirildi)"
    
    payload = {
        'chat_id': telegram_id,
        'text': message_text,
        'parse_mode': parse_mode
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    result = await response.json()
                    if result.get('ok'):
                        logger.info(f"Message sent successfully to telegram_id: {telegram_id}")
                        return True
                    else:
                        logger.error(f"Telegram API error: {result.get('description', 'Unknown error')}")
                        return False
                else:
                    error_text = await response.text()
                    logger.error(f"HTTP {response.status} error sending message: {error_text}")
                    return False
    except asyncio.TimeoutError:
        logger.error(f"Timeout sending message to telegram_id: {telegram_id}")
        return False
    except Exception as e:
        logger.error(f"Error sending message to telegram_id {telegram_id}: {e}", exc_info=True)
        return False


def send_telegram_message_sync(telegram_id, message_text, parse_mode='HTML'):
    """
    Synchronous wrapper for send_telegram_message_async
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(send_telegram_message_async(telegram_id, message_text, parse_mode))


async def send_notification_to_users(notification):
    """
    Send notification to selected users or all users
    """
    from .models import User
    
    # Get recipients
    if notification.send_to_all:
        recipients = User.objects.filter(
            telegram_id__isnull=False,
            notification_enabled=True,
            is_active=True
        ).exclude(telegram_id=0)
    else:
        recipients = notification.recipients.filter(
            telegram_id__isnull=False,
            notification_enabled=True,
            is_active=True
        ).exclude(telegram_id=0)
    
    total_recipients = recipients.count()
    successful = 0
    failed = 0
    
    # Convert HTML to Telegram format
    telegram_message = html_to_telegram_html(notification.message)
    
    # Add title if exists
    if notification.title:
        telegram_message = f"<b>{notification.title}</b>\n\n{telegram_message}"
    
    # Send messages
    for user in recipients:
        try:
            result = await send_telegram_message_async(user.telegram_id, telegram_message)
            if result:
                successful += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Error sending notification to user {user.id}: {e}", exc_info=True)
            failed += 1
    
    # Update notification statistics
    notification.total_recipients = total_recipients
    notification.successful_sends = successful
    notification.failed_sends = failed
    
    return {
        'total': total_recipients,
        'successful': successful,
        'failed': failed
    }

