import os
import asyncio
import logging
from datetime import datetime
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.fsm.storage.redis import RedisStorage
import redis.asyncio as redis
from dotenv import load_dotenv
import aiohttp

# Configure logging first
try:
    from logging_config import setup_logging
    setup_logging()
except ImportError:
    # Fallback to basic logging if logging_config not found
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)s %(asctime)s %(name)s %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
logger = logging.getLogger(__name__)

try:
    from test_handlers import (
        start_telegram_test, process_answer, request_cv_upload, show_question
    )
except ImportError as e:
    logger.warning(f"test_handlers module not found: {e}, Telegram test functionality disabled")
    start_telegram_test = None
    process_answer = None
    request_cv_upload = None
    show_question = None

# Load environment variables
load_dotenv()

# Bot configuration
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000/api')
WEBAPP_URL = os.getenv('TELEGRAM_WEBAPP_URL', 'https://yourdomain.com/webapp')
ADMIN_CHAT_ID = os.getenv('ADMIN_CHAT_ID', '')  # Admin guruh yoki kanal ID

# Initialize bot and dispatcher
bot = Bot(token=BOT_TOKEN)

# Storage configuration (Redis yoki MemoryStorage)
USE_REDIS = os.getenv('USE_REDIS', 'False').lower() == 'true'
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_DB = int(os.getenv('REDIS_DB', 0))

if USE_REDIS:
    try:
        redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)
        storage = RedisStorage(redis=redis_client)
        logger.info(f"Using Redis storage: {REDIS_HOST}:{REDIS_PORT}")
    except Exception as e:
        logger.warning(f"Redis connection failed, using MemoryStorage: {e}")
        storage = MemoryStorage()
else:
    storage = MemoryStorage()
    logger.info("Using MemoryStorage (states will be lost on restart)")

dp = Dispatcher(storage=storage)


# Admin notifications
async def send_to_admin(message_text: str, parse_mode: str = "HTML"):
    """Send message to admin group/channel"""
    if not ADMIN_CHAT_ID:
        logger.warning("ADMIN_CHAT_ID not configured, skipping admin notification")
        return
    
    try:
        chat_id = int(ADMIN_CHAT_ID) if ADMIN_CHAT_ID.lstrip('-').isdigit() else ADMIN_CHAT_ID
        
        # Clean message text - remove HTML tags if parse_mode is HTML but text contains invalid HTML
        # Sometimes error messages contain HTML from Django error pages
        if parse_mode == "HTML":
            # Remove HTML doctype and other invalid tags
            import re
            # Remove HTML doctype and html/head/body tags
            message_text = re.sub(r'<!DOCTYPE[^>]*>', '', message_text, flags=re.IGNORECASE)
            message_text = re.sub(r'<html[^>]*>', '', message_text, flags=re.IGNORECASE)
            message_text = re.sub(r'</html>', '', message_text, flags=re.IGNORECASE)
            message_text = re.sub(r'<head[^>]*>.*?</head>', '', message_text, flags=re.IGNORECASE | re.DOTALL)
            message_text = re.sub(r'<body[^>]*>', '', message_text, flags=re.IGNORECASE)
            message_text = re.sub(r'</body>', '', message_text, flags=re.IGNORECASE)
            # Remove script and style tags
            message_text = re.sub(r'<script[^>]*>.*?</script>', '', message_text, flags=re.IGNORECASE | re.DOTALL)
            message_text = re.sub(r'<style[^>]*>.*?</style>', '', message_text, flags=re.IGNORECASE | re.DOTALL)
            # Clean up extra whitespace
            message_text = re.sub(r'\s+', ' ', message_text).strip()
            # Limit message length (Telegram allows max 4096 chars)
            if len(message_text) > 4000:
                message_text = message_text[:4000] + "... (xabar qisqartirildi)"
        
        await bot.send_message(chat_id=chat_id, text=message_text, parse_mode=parse_mode)
        logger.info(f"Message sent to admin chat: {chat_id}")
    except Exception as e:
        logger.error(f"Error sending message to admin: {e}", exc_info=True)
        # Try sending without parse_mode if HTML parsing fails
        try:
            # Remove HTML tags completely and send as plain text
            import re
            plain_text = re.sub(r'<[^>]+>', '', message_text)
            plain_text = plain_text[:4000] if len(plain_text) > 4000 else plain_text
            await bot.send_message(chat_id=chat_id, text=plain_text, parse_mode=None)
            logger.info(f"Message sent to admin chat as plain text: {chat_id}")
        except Exception as e2:
            logger.error(f"Error sending plain text message to admin: {e2}", exc_info=True)


async def notify_new_candidate(user_data: dict, position_name: str = None):
    """Notify admin about new candidate registration"""
    telegram_id = user_data.get('telegram_id', 'Noma\'lum')
    first_name = user_data.get('first_name', '')
    last_name = user_data.get('last_name', '')
    email = user_data.get('email', 'Belgilanmagan')
    phone = user_data.get('phone', 'Belgilanmagan')
    
    message = (
        "🆕 <b>Yangi kandidat ro'yxatdan o'tdi</b>\n\n"
        f"👤 <b>Ism:</b> {first_name} {last_name}\n"
        f"🆔 <b>Telegram ID:</b> {telegram_id}\n"
        f"📧 <b>Email:</b> {email}\n"
        f"📱 <b>Telefon:</b> {phone}\n"
    )
    
    if position_name:
        message += f"💼 <b>Lavozim:</b> {position_name}\n"
    
    message += f"\n⏰ <b>Vaqt:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    
    await send_to_admin(message)


async def notify_test_start(user_data: dict, test_title: str, questions_count: int):
    """Notify admin about test start"""
    telegram_id = user_data.get('telegram_id', 'Noma\'lum')
    first_name = user_data.get('first_name', '')
    last_name = user_data.get('last_name', '')
    
    message = (
        "🚀 <b>Test boshlandi</b>\n\n"
        f"👤 <b>Kandidat:</b> {first_name} {last_name}\n"
        f"🆔 <b>Telegram ID:</b> {telegram_id}\n"
        f"📝 <b>Test:</b> {test_title}\n"
        f"📊 <b>Savollar soni:</b> {questions_count} ta\n"
        f"⏰ <b>Vaqt:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    )
    
    await send_to_admin(message)


async def notify_test_result(user_data: dict, test_title: str, result_data: dict):
    """Notify admin about test result"""
    telegram_id = user_data.get('telegram_id', 'Noma\'lum')
    first_name = user_data.get('first_name', '')
    last_name = user_data.get('last_name', '')
    
    score = result_data.get('score', 0)
    total_questions = result_data.get('total_questions', 0)
    correct_answers = result_data.get('correct_answers', 0)
    is_passed = result_data.get('is_passed', False)
    time_taken = result_data.get('time_taken', 0)
    
    status_emoji = "✅" if is_passed else "❌"
    status_text = "O'tdi" if is_passed else "O'tmadi"
    
    message = (
        f"{status_emoji} <b>Test natijasi</b>\n\n"
        f"👤 <b>Kandidat:</b> {first_name} {last_name}\n"
        f"🆔 <b>Telegram ID:</b> {telegram_id}\n"
        f"📝 <b>Test:</b> {test_title}\n\n"
        f"📊 <b>Natijalar:</b>\n"
        f"• Jami savollar: {total_questions}\n"
        f"• To'g'ri javoblar: {correct_answers}\n"
        f"• Ball: {score}%\n"
        f"• Vaqt: {time_taken // 60} daqiqa {time_taken % 60} soniya\n"
        f"• Holat: {status_text}\n"
        f"⏰ <b>Yakunlangan vaqt:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    )
    
    await send_to_admin(message)


async def notify_error(error_type: str, error_message: str, user_id: int = None, context: dict = None):
    """Notify admin about errors"""
    import re
    # Strip HTML tags from error message
    error_message_clean = re.sub(r'<[^>]+>', '', error_message)
    # Remove extra whitespace
    error_message_clean = re.sub(r'\s+', ' ', error_message_clean).strip()
    
    # Limit error message length (Telegram max 4096 chars)
    max_message_length = 3500
    error_msg_short = error_message_clean[:500] if len(error_message_clean) > 500 else error_message_clean
    
    message = (
        "⚠️ <b>Xatolik</b>\n"
        f"🔴 <b>Turi:</b> {error_type}\n"
        f"📝 <b>Xabar:</b> {error_msg_short}\n"
    )
    
    if user_id:
        message += f"👤 <b>User ID:</b> {user_id}\n"
    
    if context:
        # Limit context to important fields only
        important_fields = ['test_id', 'test_title', 'function', 'status_code']
        context_str = ""
        for key in important_fields:
            if key in context:
                context_str += f"• {key}: {context[key]}\n"
        
        if context_str:
            message += f"\n<b>Ma'lumot:</b>\n{context_str}"
    
    # Truncate if too long
    if len(message) > max_message_length:
        message = message[:max_message_length] + "..."
    
    await send_to_admin(message)


# States
class UserRegistration(StatesGroup):
    waiting_for_first_name = State()
    waiting_for_last_name = State()
    waiting_for_phone = State()
    waiting_for_email = State()
    waiting_for_position = State()
    selecting_position = State()


class ProfileEdit(StatesGroup):
    editing_first_name = State()
    editing_last_name = State()
    editing_phone = State()
    editing_email = State()
    editing_position = State()


class TestTaking(StatesGroup):
    selecting_mode = State()
    answering_question = State()
    waiting_for_answer = State()
    completed = State()


async def get_or_create_user(telegram_id: int, first_name: str, last_name: str = None):
    """Get or create user via API"""
    async with aiohttp.ClientSession() as session:
        # Try to authenticate/get user by telegram_id (POST request)
        async with session.post(
            f"{API_BASE_URL}/users/telegram_auth/",
            json={
                'telegram_id': telegram_id,
                'first_name': first_name,
                'last_name': last_name or ''
            }
        ) as resp:
            if resp.status in [200, 201]:
                data = await resp.json()
                return data.get('user')
    
    return None


@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    """Handle /start command"""
    user = message.from_user
    telegram_id = user.id
    
    # Get or create user
    user_data = await get_or_create_user(telegram_id, user.first_name, user.last_name)
    
    if user_data:
        # User exists, check if profile is complete
        if not user_data.get('phone') or not user_data.get('email') or not user_data.get('position'):
            await message.answer(
                "👋 Salom! Profilingizni to'ldirish kerak.\n\n"
                "Iltimos, ismingizni kiriting:"
            )
            await state.set_state(UserRegistration.waiting_for_first_name)
        else:
            # Profile complete, show main menu
            await show_main_menu(message, user_data)
    else:
        await message.answer(
            "👋 Salom! Xush kelibsiz!\n\n"
            "Iltimos, ismingizni kiriting:"
        )
        await state.set_state(UserRegistration.waiting_for_first_name)


@dp.message(UserRegistration.waiting_for_first_name)
async def process_first_name(message: types.Message, state: FSMContext):
    """Process first name"""
    await state.update_data(first_name=message.text)
    await message.answer("Familiyangizni kiriting:")
    await state.set_state(UserRegistration.waiting_for_last_name)


@dp.message(UserRegistration.waiting_for_last_name)
async def process_last_name(message: types.Message, state: FSMContext):
    """Process last name"""
    await state.update_data(last_name=message.text)
    
    keyboard = types.ReplyKeyboardMarkup(
        keyboard=[
            [types.KeyboardButton(text="📱 Telefon raqamni yuborish", request_contact=True)]
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )
    
    await message.answer(
        "Telefon raqamingizni yuboring:",
        reply_markup=keyboard
    )
    await state.set_state(UserRegistration.waiting_for_phone)


@dp.message(UserRegistration.waiting_for_phone)
async def process_phone(message: types.Message, state: FSMContext):
    """Process phone number"""
    phone = None
    if message.contact:
        phone = message.contact.phone_number
    elif message.text:
        phone = message.text
    
    if phone:
        await state.update_data(phone=phone)
        await message.answer(
            "Email manzilingizni kiriting:",
            reply_markup=types.ReplyKeyboardRemove()
        )
        await state.set_state(UserRegistration.waiting_for_email)
    else:
        await message.answer("Iltimos, telefon raqamni to'g'ri kiriting.")


@dp.message(UserRegistration.waiting_for_email)
async def process_email(message: types.Message, state: FSMContext):
    """Process email"""
    email = message.text
    if '@' in email:
        await state.update_data(email=email)
        # Show available positions
        await show_positions(message, state)
    else:
        await message.answer("Iltimos, email manzilni to'g'ri kiriting.")


async def show_positions(message: types.Message, state: FSMContext):
    """Show available positions - faqat ochiq positionlarni ko'rsatadi"""
    async with aiohttp.ClientSession() as session:
        try:
            # Faqat ochiq positionlarni olish (API'dan is_open=true filter bilan)
            async with session.get(f"{API_BASE_URL}/positions/?is_open=true") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    
                    # Handle pagination response
                    positions = []
                    if isinstance(data, dict):
                        if 'results' in data:
                            positions = data['results']
                        elif 'count' in data:
                            positions = data.get('results', [])
                    elif isinstance(data, list):
                        positions = data
                    
                    if not isinstance(positions, list):
                        positions = []
                    
                    # Double check - faqat ochiq positionlarni filter qilish
                    open_positions = [p for p in positions if isinstance(p, dict) and p.get('is_open', True)]
                    
                    if open_positions and len(open_positions) > 0:
                        keyboard = InlineKeyboardMarkup(inline_keyboard=[])
                        
                        for position in open_positions:
                            position_id = position.get('id')
                            position_name = position.get('name', 'Position')
                            if position_id:
                                keyboard.inline_keyboard.append([
                                    InlineKeyboardButton(
                                        text=f"💼 {position_name}",
                                        callback_data=f"position_{position_id}"
                                    )
                                ])
                        
                        await message.answer(
                            "💼 Qaysi lavozimga ariza topshirmoqchisiz?\n\n"
                            "Quyidagi ochiq lavozimlardan birini tanlang:",
                            reply_markup=keyboard
                        )
                        await state.set_state(UserRegistration.selecting_position)
                    else:
                        await message.answer(
                            "ℹ️ Hozircha ochiq lavozimlar mavjud emas.\n"
                            "Iltimos, keyinroq qayta urinib ko'ring."
                        )
                        await state.clear()
                else:
                    await message.answer("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")
                    await state.clear()
        except Exception as e:
            logger.error(f"Error loading positions: {e}", exc_info=True)
            await notify_error("Position yuklash xatoligi", str(e), user_id=message.from_user.id, context={'function': 'show_positions'})
            await message.answer("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")
            await state.clear()


@dp.callback_query(lambda c: c.data.startswith("position_"))
async def process_position_selection(callback: types.CallbackQuery, state: FSMContext):
    """Process position selection and complete registration - faqat ochiq positionlar"""
    try:
        position_id = int(callback.data.split("_")[1])
        data = await state.get_data()
        
        # Get position details to verify it's open
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_BASE_URL}/positions/{position_id}/") as pos_resp:
                if pos_resp.status != 200:
                    await callback.answer("❌ Lavozim topilmadi", show_alert=True)
                    return
                
                position_data = await pos_resp.json()
                if not position_data.get('is_open', False):
                    await callback.answer("❌ Bu lavozim yopiq. Faqat ochiq lavozimlarga hujjat topshirish mumkin", show_alert=True)
                    return
                
                position_name = position_data.get('name', 'Position')
                
                # Update user via API
                telegram_id = callback.from_user.id
                user_data = {
                    'telegram_id': telegram_id,
                    'first_name': data.get('first_name'),
                    'last_name': data.get('last_name'),
                    'phone': data.get('phone'),
                    'email': data.get('email'),
                    'position_id': position_id,
                }
                
                # Try to update existing user or create new one
                async with session.post(
                    f"{API_BASE_URL}/users/create_telegram_user/",
                    json=user_data
                ) as resp:
                    if resp.status in [200, 201]:
                        response_data = await resp.json()
                        user = response_data.get('user', {})
                        
                        await callback.message.edit_text(
                            f"✅ Profilingiz muvaffaqiyatli to'ldirildi!\n\n"
                            f"💼 Lavozim: {position_name}\n\n"
                            f"Endi testni boshlashingiz mumkin."
                        )
                        
                        # Notify admin about new candidate
                        try:
                            await notify_new_candidate(user, position_name)
                        except Exception as e:
                            logger.error(f"Error notifying admin about new candidate: {e}", exc_info=True)
                        
                        # Show tests for selected position
                        await show_tests_for_position(callback.message, position_id, user)
                    else:
                        error_text = await resp.text()
                        logger.error(f"Error creating user: {error_text}")
                        await callback.message.edit_text(
                            f"❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
                        )
    except Exception as e:
        logger.error(f"Error in process_position_selection: {e}", exc_info=True)
        await notify_error("Position tanlash xatoligi", str(e), user_id=callback.from_user.id, context={'function': 'process_position_selection'})
        await callback.answer("❌ Xatolik yuz berdi", show_alert=True)
    finally:
        await state.clear()
        await callback.answer()


async def show_tests_for_position(message: types.Message, position_id: int, user_data: dict = None):
    """Show tests for selected position - faqat ochiq positionlar uchun"""
    async with aiohttp.ClientSession() as session:
        try:
            # Get tests for selected position
            async with session.get(f"{API_BASE_URL}/tests/?position_id={position_id}") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    
                    # Handle pagination response
                    tests = []
                    if isinstance(data, dict):
                        if 'results' in data:
                            tests = data['results']
                        elif 'count' in data:
                            tests = data.get('results', [])
                    elif isinstance(data, list):
                        tests = data
                    
                    if not isinstance(tests, list):
                        tests = []
                    
                    if tests and len(tests) > 0:
                        # Create keyboard with tests
                        keyboard = InlineKeyboardMarkup(inline_keyboard=[])
                        
                        # Show first 5 tests
                        for test in tests[:5]:
                            if isinstance(test, dict):
                                test_id = test.get('id')
                                test_title = test.get('title', 'Test')
                                if test_id:
                                    keyboard.inline_keyboard.append([
                                        InlineKeyboardButton(
                                            text=f"📝 {test_title}",
                                            callback_data=f"test_{test_id}"
                                        )
                                    ])
                        
                        await message.answer(
                            "📋 Sizning lavozimingiz uchun mavjud testlar:\n\n"
                            "Quyidagi testlardan birini tanlang:",
                            reply_markup=keyboard
                        )
                    else:
                        await message.answer(
                            "ℹ️ Sizning lavozimingiz uchun hozircha testlar yo'q.\n"
                            "Iltimos, keyinroq qayta urinib ko'ring."
                        )
                else:
                    error_text = await resp.text()
                    logger.error(f"Error loading tests: {error_text}")
                    await message.answer(
                        f"❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
                    )
        except Exception as e:
            logger.error(f"Error in show_tests_for_position: {e}", exc_info=True)
            await notify_error("Testlar ro'yxatini yuklash xatoligi", str(e), user_id=message.from_user.id, context={'function': 'show_tests_for_position'})
            await message.answer("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")


async def show_trial_tests(message: types.Message, position_id: int, user_data: dict):
    """Show trial tests for position - only Telegram mode"""
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{API_BASE_URL}/tests/",
            params={'position_id': position_id, 'test_mode': 'telegram'}
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                tests = data.get('results', []) if isinstance(data, dict) else data
                
                if not tests or len(tests) == 0:
                    await message.answer(
                        "ℹ️ Sizning lavozimingiz uchun trial testlar mavjud emas."
                    )
                    return
                
                # Filter tests that support Telegram (trial test faqat Telegram orqali)
                trial_tests = [t for t in tests if t.get('test_mode') in ['telegram', 'both']]
                
                if not trial_tests:
                    await message.answer(
                        "ℹ️ Sizning lavozimingiz uchun trial testlar mavjud emas."
                    )
                    return
                
                # Get user's trial tests taken
                trial_tests_taken = user_data.get('trial_tests_taken', []) or []
                
                keyboard_buttons = []
                for test in trial_tests[:10]:  # Show max 10 tests
                    test_id = test.get('id')
                    test_title = test.get('title', 'Test')
                    trial_count = test.get('trial_questions_count', 10)
                    is_taken = test_id in trial_tests_taken
                    
                    button_text = f"🧪 {test_title} ({trial_count} savol)"
                    if is_taken:
                        button_text += " ✅"
                    
                    keyboard_buttons.append([
                        InlineKeyboardButton(
                            text=button_text,
                            callback_data=f"trial_test_{test_id}"
                        )
                    ])
                
                keyboard_buttons.append([
                    InlineKeyboardButton(text="🔙 Asosiy menyu", callback_data="menu_back")
                ])
                
                keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
                
                text = (
                    "🧪 <b>Trial Testlar</b>\n\n"
                    "Har bir testdan bir marta trial test yechishingiz mumkin.\n"
                    "Trial testda 10 ta savol beriladi.\n\n"
                    "Testni tanlang:"
                )
                
                await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
            else:
                await message.answer("❌ Xatolik yuz berdi.")


async def show_main_menu(message: types.Message, user_data: dict = None):
    """Show main menu with buttons"""
    if not user_data:
        user = message.from_user
        user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    
    if not user_data:
        await message.answer("❌ Xatolik yuz berdi. Iltimos, /start buyrug'ini yuboring.")
        return
    
    # Check if profile is complete
    position = user_data.get('position')
    position_name = "Belgilanmagan"
    if position:
        if isinstance(position, dict):
            position_name = position.get('name', 'Belgilanmagan')
            position_id = position.get('id')
        else:
            position_name = str(position)
            position_id = None
    else:
        position_id = None
    
    # Create menu keyboard
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📝 Test topshirish", callback_data="menu_apply")],
        [InlineKeyboardButton(text="🧪 Trial test", callback_data="menu_trial")],
        [InlineKeyboardButton(text="👤 Profilni tahrirlash", callback_data="menu_edit_profile")],
        [InlineKeyboardButton(text="📊 Natijalarim", callback_data="menu_results")],
        [InlineKeyboardButton(text="ℹ️ Profil ma'lumotlari", callback_data="menu_profile_info")],
        [InlineKeyboardButton(text="📄 CV yuklash", callback_data="menu_upload_cv")],
    ])
    
    # User info text
    first_name = user_data.get('first_name', '')
    last_name = user_data.get('last_name', '')
    email = user_data.get('email', 'Belgilanmagan')
    phone = user_data.get('phone', 'Belgilanmagan')
    
    text = (
        f"🏠 <b>Asosiy menu</b>\n\n"
        f"👤 <b>Ism:</b> {first_name} {last_name}\n"
        f"📧 <b>Email:</b> {email}\n"
        f"📱 <b>Telefon:</b> {phone}\n"
        f"💼 <b>Lavozim:</b> {position_name}\n\n"
        f"Quyidagi tugmalardan birini tanlang:"
    )
    
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")


@dp.callback_query(lambda c: c.data.startswith("test_") and not c.data.startswith("test_webapp_") and not c.data.startswith("test_telegram_"))
async def process_test_selection(callback: types.CallbackQuery, state: FSMContext):
    """Handle test selection - test mode'ga qarab WebApp yoki Telegram"""
    test_id = callback.data.split("_")[1]
    logger.info(f"Processing test_ callback for test_id: {test_id}, callback_data: {callback.data}")
    
    # Get test details
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{API_BASE_URL}/tests/{test_id}/") as resp:
            logger.info(f"API response status: {resp.status} for test_id: {test_id}")
            if resp.status == 200:
                test = await resp.json()
                logger.info(f"Test data received: {test}")
                if not test or not test.get('id'):
                    logger.warning(f"Test not found or inactive: test_id={test_id}, test_data={test}")
                    await callback.answer("❌ Test topilmadi yoki faol emas", show_alert=True)
                    return
                
                test_title = test.get('title', 'Test')
                test_description = test.get('description', '')
                time_limit = test.get('time_limit', 60)
                passing_score = test.get('passing_score', 60)
                test_mode = test.get('test_mode', 'both')
                random_count = test.get('random_questions_count', 0)
                questions_count = test.get('questions_count', 0)
                
                # Test mode'ga qarab tanlash
                if test_mode == 'telegram':
                    # Faqat Telegram
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="🚀 Testni boshlash", callback_data=f"start_telegram_test_{test_id}")],
                        [InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel_test")]
                    ])
                    await callback.message.edit_text(
                        f"📝 <b>{test_title}</b>\n\n"
                        f"{test_description}\n\n"
                        f"⏱ Vaqt: {time_limit} daqiqa\n"
                        f"📊 Savollar: {random_count if random_count > 0 else questions_count} ta\n"
                        f"✅ O'tish foizi: {passing_score}%\n\n"
                        f"Test Telegram orqali yechiladi. Testni boshlash uchun quyidagi tugmani bosing:",
                        reply_markup=keyboard,
                        parse_mode="HTML"
                    )
                    await state.update_data(test_id=test_id, test_data=test, current_question=0, answers=[])
                    await state.set_state(TestTaking.selecting_mode)
                    
                elif test_mode == 'webapp':
                    # Faqat WebApp
                    webapp_url = f"{WEBAPP_URL}?test_id={test_id}&user_id={callback.from_user.id}"
                    use_webapp = webapp_url.startswith('https://')
                    
                    try:
                        if use_webapp:
                            # HTTPS - use WebApp button
                            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                                [InlineKeyboardButton(
                                    text="🚀 Testni boshlash",
                                    web_app=WebAppInfo(url=webapp_url)
                                )]
                            ])
                        else:
                            # HTTP - Telegram HTTP URL'larni button sifatida qabul qilmaydi
                            # Shuning uchun oddiy HTML link ko'rsatamiz
                            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                                [InlineKeyboardButton(text="🔙 Orqaga", callback_data="menu_back")]
                            ])
                        
                        passing_score = test.get('passing_score', 60)
                        
                        message_text = (
                            f"📝 <b>{test_title}</b>\n\n"
                            f"{test_description}\n\n"
                            f"⏱ Vaqt: {time_limit} daqiqa\n"
                        )
                        
                        if random_count > 0 or questions_count > 0:
                            message_text += f"📊 Savollar: {random_count if random_count > 0 else questions_count} ta\n"
                        
                        message_text += f"✅ O'tish foizi: {passing_score}%\n\n"
                        
                        if not use_webapp:
                            message_text += "⚠️ <b>Development rejimida</b>\n\n"
                            message_text += f"Testni boshlash uchun quyidagi linkni brauzerda oching:\n\n"
                            message_text += f"<code>{webapp_url}</code>\n\n"
                            message_text += f"Yoki linkni bosib oching:\n<a href=\"{webapp_url}\">🚀 Testni boshlash</a>"
                        else:
                            message_text += "Testni boshlash uchun quyidagi tugmani bosing:"
                        
                        await callback.message.edit_text(
                            message_text,
                            reply_markup=keyboard,
                            parse_mode="HTML"
                        )
                    except Exception as e:
                        logger.error(f"Error creating button: {e}")
                        error_msg = str(e)
                        # Notify admin about error
                        await notify_error(
                            "WebApp tugma yaratish xatoligi",
                            error_msg,
                            user_id=callback.from_user.id,
                            context={
                                'test_id': test_id,
                                'test_title': test_title,
                                'webapp_url': webapp_url,
                                'function': 'process_test_webapp'
                            }
                        )
                        await callback.message.edit_text(
                            f"📝 <b>{test_title}</b>\n\n"
                            f"⚠️ Xatolik yuz berdi.",
                            parse_mode="HTML"
                        )
                else:
                    # Both - tanlash imkoniyati
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="🌐 WebApp orqali", callback_data=f"test_webapp_{test_id}")],
                        [InlineKeyboardButton(text="💬 Telegram orqali", callback_data=f"test_telegram_{test_id}")],
                    ])
                    passing_score = test.get('passing_score', 60)
                    
                    await callback.message.edit_text(
                        f"📝 <b>{test_title}</b>\n\n"
                        f"{test_description}\n\n"
                        f"⏱ Vaqt: {time_limit} daqiqa\n"
                        f"📊 Savollar: {random_count if random_count > 0 else questions_count} ta\n"
                        f"✅ O'tish foizi: {passing_score}%\n\n"
                        f"Testni qayerda yechmoqchisiz?",
                        reply_markup=keyboard,
                        parse_mode="HTML"
                    )
            else:
                await callback.answer("❌ Test topilmadi", show_alert=True)
    
    await callback.answer()


@dp.callback_query(lambda c: c.data.startswith("test_webapp_"))
async def process_test_webapp(callback: types.CallbackQuery):
    """Handle WebApp test selection"""
    # test_webapp_3 -> ['test', 'webapp', '3'] -> test_id = '3'
    parts = callback.data.split("_")
    if len(parts) >= 3:
        test_id = parts[2]
    else:
        await callback.answer("❌ Noto'g'ri test ID", show_alert=True)
        return
    logger.info(f"Processing test_webapp_ callback for test_id: {test_id}, callback_data: {callback.data}")
    
    # Get test details
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{API_BASE_URL}/tests/{test_id}/") as resp:
            logger.info(f"API response status: {resp.status} for test_id: {test_id}")
            if resp.status == 200:
                test = await resp.json()
                logger.info(f"Test data received: {test}")
                if not test or not test.get('id'):
                    logger.warning(f"Test not found or inactive: test_id={test_id}, test_data={test}")
                    await callback.answer("❌ Test topilmadi yoki faol emas", show_alert=True)
                    return
                
                test_title = test.get('title', 'Test')
                test_description = test.get('description', '')
                time_limit = test.get('time_limit', 60)
                passing_score = test.get('passing_score', 60)
                random_count = test.get('random_questions_count', 0)
                questions_count = test.get('questions_count', 0)
                
                # Create WebApp URL
                webapp_url = f"{WEBAPP_URL}?test_id={test_id}&user_id={callback.from_user.id}"
                use_webapp = webapp_url.startswith('https://')
                
                try:
                    # Build message text first
                    message_text = (
                        f"📝 <b>{test_title}</b>\n\n"
                        f"{test_description}\n\n"
                        f"⏱ Vaqt: {time_limit} daqiqa\n"
                    )
                    
                    if random_count > 0 or questions_count > 0:
                        message_text += f"📊 Savollar: {random_count if random_count > 0 else questions_count} ta\n"
                    
                    message_text += f"✅ O'tish foizi: {passing_score}%\n\n"
                    
                    if use_webapp:
                        # HTTPS - use WebApp button
                        keyboard = InlineKeyboardMarkup(inline_keyboard=[
                            [InlineKeyboardButton(
                                text="🚀 Testni boshlash",
                                web_app=WebAppInfo(url=webapp_url)
                            )]
                        ])
                        message_text += "Testni boshlash uchun quyidagi tugmani bosing:"
                    else:
                        # HTTP - Telegram HTTP URL'larni qabul qilmaydi, shuning uchun oddiy matn link ko'rsatamiz
                        # Linkni ko'rsatish va URL ni nusxalash uchun button qo'shamiz
                        keyboard = InlineKeyboardMarkup(inline_keyboard=[
                            [InlineKeyboardButton(text="🔙 Orqaga", callback_data="menu_back")]
                        ])
                        message_text += "⚠️ <b>Development rejimida</b>\n\n"
                        message_text += f"Testni boshlash uchun quyidagi linkni brauzerda oching:\n\n"
                        message_text += f"<code>{webapp_url}</code>\n\n"
                        message_text += f"Yoki linkni bosib oching:\n<a href=\"{webapp_url}\">🚀 Testni boshlash</a>"
                    
                    await callback.message.edit_text(
                        message_text,
                        reply_markup=keyboard,
                        parse_mode="HTML"
                    )
                except Exception as e:
                    logger.error(f"Error creating button: {e}")
                    error_msg = str(e)
                    # Notify admin about error
                    await notify_error(
                        "WebApp tugma yaratish xatoligi",
                        error_msg,
                        user_id=callback.from_user.id,
                        context={
                            'test_id': test_id,
                            'test_title': test_title,
                            'webapp_url': webapp_url,
                            'function': 'process_test_webapp'
                        }
                    )
                    await callback.message.edit_text(
                        f"📝 <b>{test_title}</b>\n\n"
                        f"⚠️ Xatolik yuz berdi.",
                        parse_mode="HTML"
                    )
            else:
                await callback.answer("❌ Test topilmadi", show_alert=True)
    
    await callback.answer()


@dp.callback_query(lambda c: c.data.startswith("test_telegram_"))
async def process_test_telegram(callback: types.CallbackQuery, state: FSMContext):
    """Handle Telegram test selection"""
    # test_telegram_3 -> ['test', 'telegram', '3'] -> test_id = '3'
    parts = callback.data.split("_")
    if len(parts) >= 3:
        test_id = parts[2]
    else:
        await callback.answer("❌ Noto'g'ri test ID", show_alert=True)
        return
    logger.info(f"Processing test_telegram_ callback for test_id: {test_id}, callback_data: {callback.data}")
    
    # Get test details
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{API_BASE_URL}/tests/{test_id}/") as resp:
            logger.info(f"API response status: {resp.status} for test_id: {test_id}")
            if resp.status == 200:
                test = await resp.json()
                logger.info(f"Test data received: {test}")
                if not test or not test.get('id'):
                    logger.warning(f"Test not found or inactive: test_id={test_id}, test_data={test}")
                    await callback.answer("❌ Test topilmadi yoki faol emas", show_alert=True)
                    return
                
                test_title = test.get('title', 'Test')
                test_description = test.get('description', '')
                time_limit = test.get('time_limit', 60)
                passing_score = test.get('passing_score', 60)
                random_count = test.get('random_questions_count', 0)
                questions_count = test.get('questions_count', 0)
                
                # Telegram test mode
                keyboard = InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="🚀 Testni boshlash", callback_data=f"start_telegram_test_{test_id}")],
                    [InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel_test")]
                ])
                await callback.message.edit_text(
                    f"📝 <b>{test_title}</b>\n\n"
                    f"{test_description}\n\n"
                    f"⏱ Vaqt: {time_limit} daqiqa\n"
                    f"📊 Savollar: {random_count if random_count > 0 else questions_count} ta\n"
                    f"✅ O'tish foizi: {passing_score}%\n\n"
                    f"Test Telegram orqali yechiladi. Testni boshlash uchun quyidagi tugmani bosing:",
                    reply_markup=keyboard,
                    parse_mode="HTML"
                )
                await state.update_data(test_id=test_id, test_data=test, current_question=0, answers=[])
                await state.set_state(TestTaking.selecting_mode)
            else:
                await callback.answer("❌ Test topilmadi", show_alert=True)
    
    await callback.answer()


@dp.callback_query(lambda c: c.data.startswith("start_telegram_test_"))
async def handle_start_telegram_test(callback: types.CallbackQuery, state: FSMContext):
    """Handle start telegram test"""
    try:
        logger.info(f"handle_start_telegram_test called for user {callback.from_user.id}")
        if start_telegram_test:
            # Save notify_callback to state
            await state.update_data(notify_callback=notify_test_result, notify_error_callback=notify_error, is_trial=False)
            logger.info("Calling start_telegram_test")
            await start_telegram_test(callback, state, notify_callback=notify_test_result, notify_start_callback=notify_test_start, notify_error_callback=notify_error)
        else:
            logger.error("start_telegram_test function not found")
            await callback.answer("❌ Telegram test funksiyasi mavjud emas", show_alert=True)
        await callback.answer()
    except Exception as e:
        logger.error(f"Error in handle_start_telegram_test: {e}", exc_info=True)
        await notify_error(
            "Telegram testni boshlash xatoligi",
            str(e),
            user_id=callback.from_user.id,
            context={'function': 'handle_start_telegram_test', 'callback_data': callback.data}
        )
        await callback.answer("❌ Xatolik yuz berdi", show_alert=True)


@dp.callback_query(lambda c: c.data.startswith("start_trial_test_"))
async def handle_start_trial_test(callback: types.CallbackQuery, state: FSMContext):
    """Handle start trial test - only Telegram mode"""
    if start_telegram_test:
        # Save notify_callback to state and mark as trial
        await state.update_data(notify_callback=notify_test_result, notify_error_callback=notify_error, is_trial=True)
        await start_telegram_test(callback, state, notify_callback=notify_test_result, notify_start_callback=notify_test_start, notify_error_callback=notify_error)
    else:
        await callback.answer("❌ Telegram test funksiyasi mavjud emas", show_alert=True)
    await callback.answer()


@dp.callback_query(lambda c: c.data.startswith("answer_"))
async def handle_answer(callback: types.CallbackQuery, state: FSMContext):
    """Handle answer to question"""
    try:
        logger.info(f"handle_answer called for user {callback.from_user.id}, callback_data: {callback.data}")
        if process_answer:
            await process_answer(callback, state)
        else:
            logger.error("process_answer function not found")
            await callback.answer("❌ Javobni qayta ishlash funksiyasi mavjud emas", show_alert=True)
        await callback.answer()
    except Exception as e:
        logger.error(f"Error in handle_answer: {e}", exc_info=True)
        data = await state.get_data()
        notify_error_callback = data.get('notify_error_callback', notify_error)
        if notify_error_callback:
            try:
                await notify_error_callback(
                    "Javobni qayta ishlash xatoligi",
                    str(e),
                    user_id=callback.from_user.id,
                    context={'function': 'handle_answer', 'callback_data': callback.data}
                )
            except Exception as notify_err:
                logger.error(f"Error notifying admin: {notify_err}", exc_info=True)
        await callback.answer("❌ Xatolik yuz berdi", show_alert=True)


@dp.callback_query(lambda c: c.data == "cancel_test")
async def cancel_test(callback: types.CallbackQuery, state: FSMContext):
    """Cancel test"""
    await state.clear()
    await callback.message.edit_text("❌ Test bekor qilindi.")
    await callback.answer()


@dp.message(Command("menu"))
async def cmd_menu(message: types.Message):
    """Show main menu"""
    user = message.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    
    # Check if user is blocked
    if user_data and user_data.get('is_blocked'):
        await message.answer(
            f"❌ <b>Siz block qilingansiz!</b>\n\n"
            f"Sabab: {user_data.get('blocked_reason', 'Noma\'lum sabab')}\n\n"
            f"Vakansiyangiz ko'rib chiqishdan to'xtatilgan.",
            parse_mode="HTML"
        )
        return
    
    await show_main_menu(message, user_data)


@dp.message(Command("trial"))
async def cmd_trial(message: types.Message):
    """Show trial tests menu"""
    user = message.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    
    if not user_data or not user_data.get('position'):
        await message.answer(
            "⚠️ Sizning profilingiz to'liq emas.\n"
            "Iltimos, /start buyrug'ini yuborib profilingizni to'ldiring."
        )
        return
    
    # Get user position
    position = user_data.get('position')
    if isinstance(position, dict):
        position_id = position.get('id')
    else:
        position_id = None
    
    if position_id:
        await show_trial_tests(message, position_id, user_data)
    else:
        await message.answer(
            "⚠️ Sizning lavozimingiz belgilanmagan.\n"
            "Iltimos, /start buyrug'ini yuborib profilingizni to'ldiring."
        )


@dp.message(Command("apply"))
async def cmd_apply(message: types.Message):
    """Apply for test"""
    user = message.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    
    if not user_data or not user_data.get('position'):
        await message.answer(
            "⚠️ Sizning profilingiz to'liq emas.\n"
            "Iltimos, /start buyrug'ini yuborib profilingizni to'ldiring."
        )
        return
    
    # Get user position
    position = user_data.get('position')
    if isinstance(position, dict):
        position_id = position.get('id')
    else:
        position_id = None
    
    if position_id:
        await show_tests_for_position(message, position_id, user_data)
    else:
        await message.answer(
            "⚠️ Sizning lavozimingiz belgilanmagan.\n"
            "Iltimos, /start buyrug'ini yuborib profilingizni to'ldiring."
        )


@dp.message(Command("profile"))
async def cmd_profile(message: types.Message):
    """Edit profile"""
    user = message.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    
    if not user_data:
        await message.answer("❌ Xatolik yuz berdi. Iltimos, /start buyrug'ini yuboring.")
        return
    
    await show_profile_edit_menu(message, user_data)


@dp.message(Command("results"))
async def cmd_results(message: types.Message):
    """Show user's test results"""
    telegram_id = message.from_user.id
    
    async with aiohttp.ClientSession() as session:
        # Get user results
        async with session.get(
            f"{API_BASE_URL}/results/",
            params={'user__telegram_id': telegram_id}
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                
                # Handle pagination response
                results = []
                if isinstance(data, dict):
                    if 'results' in data:
                        results = data['results']
                    elif 'count' in data:
                        results = data.get('results', [])
                elif isinstance(data, list):
                    results = data
                
                if not isinstance(results, list):
                    results = []
                
                if results and len(results) > 0:
                    text = "📊 Sizning test natijalaringiz:\n\n"
                    for result in results[:10]:  # Show last 10 results
                        if isinstance(result, dict):
                            test_data = result.get('test', {})
                            if isinstance(test_data, dict):
                                test_title = test_data.get('title', 'Test')
                            else:
                                test_title = 'Test'
                            score = result.get('score', 0)
                            is_passed = result.get('is_passed', False)
                            status_emoji = "✅" if is_passed else "❌"
                            text += f"{status_emoji} <b>{test_title}</b>\n"
                            text += f"   Ball: {score}%\n\n"
                    
                    await message.answer(text, parse_mode="HTML")
                else:
                    await message.answer("ℹ️ Siz hali test topshirmadingiz.")
            else:
                await message.answer("❌ Xatolik yuz berdi.")


async def show_profile_edit_menu(message: types.Message, user_data: dict):
    """Show profile edit menu"""
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✏️ Ismni o'zgartirish", callback_data="edit_first_name")],
        [InlineKeyboardButton(text="✏️ Familiyani o'zgartirish", callback_data="edit_last_name")],
        [InlineKeyboardButton(text="✏️ Telefonni o'zgartirish", callback_data="edit_phone")],
        [InlineKeyboardButton(text="✏️ Emailni o'zgartirish", callback_data="edit_email")],
        [InlineKeyboardButton(text="✏️ Lavozimni o'zgartirish", callback_data="edit_position")],
        [InlineKeyboardButton(text="🔙 Orqaga", callback_data="menu_back")],
    ])
    
    text = (
        "✏️ <b>Profilni tahrirlash</b>\n\n"
        "Qaysi maydonni o'zgartirmoqchisiz?"
    )
    
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")


# Menu callbacks
@dp.callback_query(lambda c: c.data == "menu_apply")
async def menu_apply(callback: types.CallbackQuery):
    """Apply for test from menu"""
    user = callback.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    
    if not user_data or not user_data.get('position'):
        await callback.answer("⚠️ Profilingiz to'liq emas. Iltimos, /start buyrug'ini yuboring.", show_alert=True)
        return
    
    position = user_data.get('position')
    if isinstance(position, dict):
        position_id = position.get('id')
    else:
        position_id = None
    
    if position_id:
        await callback.message.delete()
        await show_tests_for_position(callback.message, position_id, user_data)
    else:
        await callback.answer("⚠️ Lavozimingiz belgilanmagan.", show_alert=True)
    
    await callback.answer()


@dp.callback_query(lambda c: c.data == "menu_edit_profile")
async def menu_edit_profile(callback: types.CallbackQuery):
    """Edit profile from menu"""
    user = callback.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    
    if not user_data:
        await callback.answer("❌ Xatolik yuz berdi.", show_alert=True)
        return
    
    await callback.message.delete()
    await show_profile_edit_menu(callback.message, user_data)
    await callback.answer()


@dp.callback_query(lambda c: c.data == "menu_results")
async def menu_results(callback: types.CallbackQuery):
    """Show results from menu"""
    telegram_id = callback.from_user.id
    
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{API_BASE_URL}/results/",
            params={'user__telegram_id': telegram_id}
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                
                results = []
                if isinstance(data, dict):
                    if 'results' in data:
                        results = data['results']
                    elif 'count' in data:
                        results = data.get('results', [])
                elif isinstance(data, list):
                    results = data
                
                if not isinstance(results, list):
                    results = []
                
                if results and len(results) > 0:
                    text = "📊 Sizning test natijalaringiz:\n\n"
                    for result in results[:10]:
                        if isinstance(result, dict):
                            test_data = result.get('test', {})
                            if isinstance(test_data, dict):
                                test_title = test_data.get('title', 'Test')
                            else:
                                test_title = 'Test'
                            score = result.get('score', 0)
                            is_passed = result.get('is_passed', False)
                            status_emoji = "✅" if is_passed else "❌"
                            text += f"{status_emoji} <b>{test_title}</b>\n"
                            text += f"   Ball: {score}%\n\n"
                    
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="🔙 Orqaga", callback_data="menu_back")]
                    ])
                    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
                else:
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="🔙 Orqaga", callback_data="menu_back")]
                    ])
                    await callback.message.edit_text("ℹ️ Siz hali test topshirmadingiz.", reply_markup=keyboard)
            else:
                await callback.message.edit_text("❌ Xatolik yuz berdi.")
    
    await callback.answer()


@dp.callback_query(lambda c: c.data == "menu_profile_info")
async def menu_profile_info(callback: types.CallbackQuery):
    """Show profile info from menu"""
    user = callback.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    
    if not user_data:
        await callback.answer("❌ Xatolik yuz berdi.", show_alert=True)
        return
    
    position = user_data.get('position')
    position_name = "Belgilanmagan"
    if position:
        if isinstance(position, dict):
            position_name = position.get('name', 'Belgilanmagan')
        else:
            position_name = str(position)
    
    first_name = user_data.get('first_name', '')
    last_name = user_data.get('last_name', '')
    email = user_data.get('email', 'Belgilanmagan')
    phone = user_data.get('phone', 'Belgilanmagan')
    telegram_id = user_data.get('telegram_id', callback.from_user.id)
    
    text = (
        f"👤 <b>Profil ma'lumotlari</b>\n\n"
        f"🆔 <b>Telegram ID:</b> {telegram_id}\n"
        f"👤 <b>Ism:</b> {first_name} {last_name}\n"
        f"📧 <b>Email:</b> {email}\n"
        f"📱 <b>Telefon:</b> {phone}\n"
        f"💼 <b>Lavozim:</b> {position_name}\n\n"
        f"Profilni tahrirlash uchun /profile buyrug'ini yuboring."
    )
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Orqaga", callback_data="menu_back")]
    ])
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()


@dp.callback_query(lambda c: c.data == "menu_trial")
async def menu_trial(callback: types.CallbackQuery):
    """Show trial tests menu"""
    user = callback.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    
    if not user_data or not user_data.get('position'):
        await callback.answer("⚠️ Profilingiz to'liq emas", show_alert=True)
        return
    
    position = user_data.get('position')
    if isinstance(position, dict):
        position_id = position.get('id')
    else:
        position_id = None
    
    if position_id:
        await show_trial_tests(callback.message, position_id, user_data)
    else:
        await callback.answer("⚠️ Lavozimingiz belgilanmagan", show_alert=True)
    
    await callback.answer()


@dp.callback_query(lambda c: c.data.startswith("trial_test_"))
async def handle_trial_test(callback: types.CallbackQuery, state: FSMContext):
    """Handle trial test selection - only Telegram mode"""
    test_id = callback.data.split("_")[2]
    
    # Get test details
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{API_BASE_URL}/tests/{test_id}/") as resp:
            if resp.status == 200:
                test = await resp.json()
                test_title = test.get('title', 'Test')
                trial_count = test.get('trial_questions_count', 10)
                time_limit = test.get('time_limit', 60)
                test_mode = test.get('test_mode', 'both')
                
                # Check if test supports Telegram
                if test_mode not in ['telegram', 'both']:
                    await callback.answer(
                        "⚠️ Bu test faqat WebApp orqali ishlaydi. Trial test faqat Telegram orqali mavjud.",
                        show_alert=True
                    )
                    return
                
                # Check if user already took trial test
                user_data = await get_or_create_user(
                    callback.from_user.id, 
                    callback.from_user.first_name, 
                    callback.from_user.last_name
                )
                trial_tests_taken = user_data.get('trial_tests_taken', []) or []
                
                if int(test_id) in trial_tests_taken:
                    await callback.answer(
                        "⚠️ Siz bu testdan trial test olgansiz. Faqat bir marta yechishingiz mumkin.",
                        show_alert=True
                    )
                    return
                
                # Save test data to state for Telegram test
                await state.update_data(
                    test_id=test_id,
                    test_data=test,
                    current_question=0,
                    answers=[],
                    is_trial=True
                )
                
                # Show test info and start button
                keyboard = InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(
                        text="🚀 Trial testni boshlash",
                        callback_data=f"start_trial_test_{test_id}"
                    )],
                    [InlineKeyboardButton(text="❌ Bekor qilish", callback_data="menu_trial")]
                ])
                
                message_text = (
                    f"🧪 <b>Trial Test</b>\n\n"
                    f"📝 <b>{test_title}</b>\n\n"
                    f"📊 Savollar: {trial_count} ta\n"
                    f"⏱ Vaqt: {time_limit} daqiqa\n\n"
                    f"Trial testni boshlash uchun quyidagi tugmani bosing:"
                )
                
                try:
                    await callback.message.edit_text(
                        message_text,
                        reply_markup=keyboard,
                        parse_mode="HTML"
                    )
                except Exception as e:
                    logger.error(f"Error editing message: {e}")
                    await notify_error(
                        "Trial test xabarni tahrirlash xatoligi",
                        str(e),
                        user_id=callback.from_user.id,
                        context={
                            'test_id': test_id,
                            'test_title': test_title,
                            'function': 'handle_trial_test'
                        }
                    )
                    await callback.answer("❌ Xatolik yuz berdi", show_alert=True)
            else:
                await callback.answer("❌ Test topilmadi", show_alert=True)
    
    await callback.answer()


@dp.callback_query(lambda c: c.data == "menu_back")
async def menu_back(callback: types.CallbackQuery, state: FSMContext):
    """Back to main menu"""
    await state.clear()
    user = callback.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    await show_main_menu(callback.message, user_data)
    await callback.answer()


@dp.callback_query(lambda c: c.data == "menu_upload_cv")
async def menu_upload_cv(callback: types.CallbackQuery):
    """Handle CV upload from menu"""
    telegram_id = callback.from_user.id
    
    # Check if user has passed any test
    async with aiohttp.ClientSession() as session:
        # Get user's test results
        async with session.get(
            f"{API_BASE_URL}/results/",
            params={'user__telegram_id': telegram_id, 'is_completed': 'true'}
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                results = []
                if isinstance(data, dict):
                    results = data.get('results', [])
                elif isinstance(data, list):
                    results = data
                
                # Check if user has passed any test
                has_passed = False
                for result in results:
                    if isinstance(result, dict):
                        is_passed = result.get('is_passed', False)
                        if is_passed:
                            has_passed = True
                            break
                
                if not has_passed:
                    await callback.answer(
                        "⚠️ Siz avval testdan o'tishingiz kerak!\n\n"
                        "CV yuklash uchun kamida bitta testdan muvaffaqiyatli o'tishingiz kerak.",
                        show_alert=True
                    )
                    return
                
                # User has passed, request CV upload
                await callback.message.edit_text(
                    "📄 <b>CV yuklash</b>\n\n"
                    "CV faylingizni yuboring (PDF, DOC, DOCX formatida).\n\n"
                    "Yoki /upload_cv buyrug'ini yuboring.",
                    parse_mode="HTML"
                )
            else:
                await callback.answer("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.", show_alert=True)
    
    await callback.answer()


@dp.message(Command("upload_cv"))
async def cmd_upload_cv(message: types.Message):
    """Handle CV upload command"""
    telegram_id = message.from_user.id
    
    # Check if user has passed any test
    async with aiohttp.ClientSession() as session:
        # Get user's test results
        async with session.get(
            f"{API_BASE_URL}/results/",
            params={'user__telegram_id': telegram_id, 'is_completed': 'true'}
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                results = []
                if isinstance(data, dict):
                    results = data.get('results', [])
                elif isinstance(data, list):
                    results = data
                
                # Check if user has passed any test
                has_passed = False
                for result in results:
                    if isinstance(result, dict):
                        is_passed = result.get('is_passed', False)
                        if is_passed:
                            has_passed = True
                            break
                
                if not has_passed:
                    await message.answer(
                        "⚠️ <b>Siz avval testdan o'tishingiz kerak!</b>\n\n"
                        "CV yuklash uchun kamida bitta testdan muvaffaqiyatli o'tishingiz kerak.\n\n"
                        "Test topshirish uchun /apply buyrug'ini yuboring.",
                        parse_mode="HTML"
                    )
                    return
                
                # User has passed, request CV upload
                await message.answer(
                    "📄 <b>CV yuklash</b>\n\n"
                    "CV faylingizni yuboring (PDF, DOC, DOCX formatida).",
                    parse_mode="HTML"
                )
            else:
                await message.answer("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")


@dp.message(Command("info"))
async def cmd_info(message: types.Message):
    """Handle info command - show profile information"""
    try:
        telegram_id = message.from_user.id
        
        # Get user data from API
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{API_BASE_URL}/users/telegram_auth/",
                json={
                    'telegram_id': telegram_id,
                    'first_name': message.from_user.first_name or '',
                    'last_name': message.from_user.last_name or ''
                }
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    user_data = data.get('user', {})
                    
                    if user_data:
                        # Show profile information
                        text = "ℹ️ <b>Profil ma'lumotlari</b>\n\n"
                        text += f"👤 <b>Ism:</b> {user_data.get('first_name', '')} {user_data.get('last_name', '')}\n"
                        text += f"🆔 <b>Telegram ID:</b> {user_data.get('telegram_id', 'N/A')}\n"
                        text += f"📧 <b>Email:</b> {user_data.get('email', 'Belgilanmagan')}\n"
                        text += f"📱 <b>Telefon:</b> {user_data.get('phone', 'Belgilanmagan')}\n"
                        
                        position = user_data.get('position')
                        if position:
                            if isinstance(position, dict):
                                position_name = position.get('name', 'Belgilanmagan')
                            else:
                                position_name = str(position)
                            text += f"💼 <b>Lavozim:</b> {position_name}\n"
                        else:
                            text += f"💼 <b>Lavozim:</b> Belgilanmagan\n"
                        
                        if user_data.get('is_blocked'):
                            text += f"\n⚠️ <b>Holat:</b> Block qilingan\n"
                            text += f"📝 <b>Sabab:</b> {user_data.get('blocked_reason', 'Noma\'lum')}\n"
                        else:
                            text += f"\n✅ <b>Holat:</b> Faol\n"
                        
                        await message.answer(text, parse_mode="HTML")
                    else:
                        await message.answer("❌ Foydalanuvchi ma'lumotlari topilmadi.")
                else:
                    await message.answer("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")
    except Exception as e:
        logger.error(f"Error in cmd_info: {e}", exc_info=True)
        await notify_error("Profil ma'lumotlarini ko'rsatish xatoligi", str(e), user_id=message.from_user.id, context={'function': 'cmd_info'})
        await message.answer("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")


@dp.callback_query(lambda c: c.data.startswith("back_question_"))
async def handle_back_question(callback: types.CallbackQuery, state: FSMContext):
    """Handle back to previous question"""
    try:
        logger.info(f"handle_back_question called for user {callback.from_user.id}, callback_data: {callback.data}")
        # Get question index from callback data
        question_index = int(callback.data.split("_")[2])
        logger.info(f"Going back to question {question_index}")
        data = await state.get_data()
        notify_callback = data.get('notify_callback')
        notify_error_callback = data.get('notify_error_callback')
        
        # Show previous question
        if show_question:
            await show_question(callback.message, state, question_index, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
        else:
            logger.error("show_question function not found")
            await callback.answer("❌ Funksiya mavjud emas", show_alert=True)
        await callback.answer()
    except Exception as e:
        logger.error(f"Error in handle_back_question: {e}", exc_info=True)
        data = await state.get_data()
        notify_error_callback = data.get('notify_error_callback', notify_error)
        if notify_error_callback:
            try:
                await notify_error_callback(
                    "Oldingi savolga qaytish xatoligi",
                    str(e),
                    user_id=callback.from_user.id,
                    context={'function': 'handle_back_question', 'callback_data': callback.data}
                )
            except Exception as notify_err:
                logger.error(f"Error notifying admin: {notify_err}", exc_info=True)
        await callback.answer("❌ Xatolik yuz berdi", show_alert=True)


# Profile edit callbacks
@dp.callback_query(lambda c: c.data == "edit_first_name")
async def edit_first_name(callback: types.CallbackQuery, state: FSMContext):
    """Edit first name"""
    await callback.message.edit_text("✏️ Yangi ismingizni kiriting:")
    await state.set_state(ProfileEdit.editing_first_name)
    await callback.answer()


@dp.callback_query(lambda c: c.data == "edit_last_name")
async def edit_last_name(callback: types.CallbackQuery, state: FSMContext):
    """Edit last name"""
    await callback.message.edit_text("✏️ Yangi familiyangizni kiriting:")
    await state.set_state(ProfileEdit.editing_last_name)
    await callback.answer()


@dp.callback_query(lambda c: c.data == "edit_phone")
async def edit_phone(callback: types.CallbackQuery, state: FSMContext):
    """Edit phone"""
    await callback.message.edit_text("✏️ Yangi telefon raqamingizni kiriting:")
    await state.set_state(ProfileEdit.editing_phone)
    await callback.answer()


@dp.callback_query(lambda c: c.data == "edit_email")
async def edit_email(callback: types.CallbackQuery, state: FSMContext):
    """Edit email"""
    await callback.message.edit_text("✏️ Yangi email manzilingizni kiriting:")
    await state.set_state(ProfileEdit.editing_email)
    await callback.answer()


@dp.callback_query(lambda c: c.data == "edit_position")
async def edit_position(callback: types.CallbackQuery, state: FSMContext):
    """Edit position"""
    await show_positions(callback.message, state)
    await state.set_state(ProfileEdit.editing_position)
    await callback.answer()


# Profile edit handlers
@dp.message(ProfileEdit.editing_first_name)
async def process_edit_first_name(message: types.Message, state: FSMContext):
    """Process first name edit"""
    telegram_id = message.from_user.id
    new_first_name = message.text
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_BASE_URL}/users/create_telegram_user/",
            json={
                'telegram_id': telegram_id,
                'first_name': new_first_name
            }
        ) as resp:
            if resp.status in [200, 201]:
                await message.answer("✅ Ism muvaffaqiyatli o'zgartirildi!")
                user_data = await get_or_create_user(telegram_id, new_first_name)
                await show_main_menu(message, user_data)
            else:
                await message.answer("❌ Xatolik yuz berdi.")
    
    await state.clear()


@dp.message(ProfileEdit.editing_last_name)
async def process_edit_last_name(message: types.Message, state: FSMContext):
    """Process last name edit"""
    telegram_id = message.from_user.id
    new_last_name = message.text
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_BASE_URL}/users/create_telegram_user/",
            json={
                'telegram_id': telegram_id,
                'last_name': new_last_name
            }
        ) as resp:
            if resp.status in [200, 201]:
                await message.answer("✅ Familiya muvaffaqiyatli o'zgartirildi!")
                user_data = await get_or_create_user(telegram_id, message.from_user.first_name)
                await show_main_menu(message, user_data)
            else:
                await message.answer("❌ Xatolik yuz berdi.")
    
    await state.clear()


@dp.message(ProfileEdit.editing_phone)
async def process_edit_phone(message: types.Message, state: FSMContext):
    """Process phone edit"""
    telegram_id = message.from_user.id
    new_phone = message.text
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_BASE_URL}/users/create_telegram_user/",
            json={
                'telegram_id': telegram_id,
                'phone': new_phone
            }
        ) as resp:
            if resp.status in [200, 201]:
                await message.answer("✅ Telefon raqami muvaffaqiyatli o'zgartirildi!")
                user_data = await get_or_create_user(telegram_id, message.from_user.first_name)
                await show_main_menu(message, user_data)
            else:
                await message.answer("❌ Xatolik yuz berdi.")
    
    await state.clear()


@dp.message(ProfileEdit.editing_email)
async def process_edit_email(message: types.Message, state: FSMContext):
    """Process email edit"""
    telegram_id = message.from_user.id
    new_email = message.text
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_BASE_URL}/users/create_telegram_user/",
            json={
                'telegram_id': telegram_id,
                'email': new_email
            }
        ) as resp:
            if resp.status in [200, 201]:
                await message.answer("✅ Email muvaffaqiyatli o'zgartirildi!")
                user_data = await get_or_create_user(telegram_id, message.from_user.first_name)
                await show_main_menu(message, user_data)
            else:
                await message.answer("❌ Xatolik yuz berdi.")
    
    await state.clear()


@dp.callback_query(lambda c: c.data.startswith("position_"), ProfileEdit.editing_position)
async def process_edit_position_selection(callback: types.CallbackQuery, state: FSMContext):
    """Process position selection for profile edit"""
    try:
        position_id = int(callback.data.split("_")[1])
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_BASE_URL}/positions/{position_id}/") as pos_resp:
                if pos_resp.status != 200:
                    await callback.answer("❌ Lavozim topilmadi", show_alert=True)
                    return
                
                position_data = await pos_resp.json()
                if not position_data.get('is_open', False):
                    await callback.answer("❌ Bu lavozim yopiq.", show_alert=True)
                    return
                
                position_name = position_data.get('name', 'Position')
                
                telegram_id = callback.from_user.id
                async with session.post(
                    f"{API_BASE_URL}/users/create_telegram_user/",
                    json={
                        'telegram_id': telegram_id,
                        'position_id': position_id
                    }
                ) as resp:
                    if resp.status in [200, 201]:
                        await callback.message.edit_text(
                            f"✅ Lavozim muvaffaqiyatli o'zgartirildi!\n\n"
                            f"💼 Yangi lavozim: {position_name}"
                        )
                        user_data = await get_or_create_user(telegram_id, callback.from_user.first_name)
                        await show_main_menu(callback.message, user_data)
                    else:
                        await callback.message.edit_text("❌ Xatolik yuz berdi.")
    except Exception as e:
        logger.error(f"Error in process_edit_position_selection: {e}", exc_info=True)
        await callback.answer("❌ Xatolik yuz berdi", show_alert=True)
    finally:
        await state.clear()
        await callback.answer()


async def setup_bot_commands():
    """Setup bot commands menu"""
    commands = [
        types.BotCommand(command="start", description="Botni boshlash"),
        types.BotCommand(command="menu", description="Asosiy menu"),
        types.BotCommand(command="apply", description="📝 Test topshirish"),
        types.BotCommand(command="trial", description="🧪 Trial test"),
        types.BotCommand(command="profile", description="👤 Profilni tahrirlash"),
        types.BotCommand(command="results", description="📊 Natijalarim"),
        types.BotCommand(command="upload_cv", description="📄 CV yuklash"),
        types.BotCommand(command="info", description="ℹ️ Profil ma'lumotlari"),
    ]
    await bot.set_my_commands(commands)
    logger.info("Bot commands menu set")


async def main():
    """Main function"""
    logger.info("Starting bot...")
    await setup_bot_commands()
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

