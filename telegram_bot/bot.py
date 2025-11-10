import os
import asyncio
import logging
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

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bot configuration
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000/api')
WEBAPP_URL = os.getenv('TELEGRAM_WEBAPP_URL', 'https://yourdomain.com/webapp')

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
            await message.answer("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")


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
        [InlineKeyboardButton(text="👤 Profilni tahrirlash", callback_data="menu_edit_profile")],
        [InlineKeyboardButton(text="📊 Natijalarim", callback_data="menu_results")],
        [InlineKeyboardButton(text="ℹ️ Profil ma'lumotlari", callback_data="menu_profile_info")],
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


@dp.callback_query(lambda c: c.data.startswith("test_"))
async def process_test_selection(callback: types.CallbackQuery, state: FSMContext):
    """Handle test selection"""
    test_id = callback.data.split("_")[1]
    
    # Get test details
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{API_BASE_URL}/tests/{test_id}/") as resp:
            if resp.status == 200:
                test = await resp.json()
                test_title = test.get('title', 'Test')
                test_description = test.get('description', '')
                time_limit = test.get('time_limit', 60)
                
                # Create WebApp button
                webapp_url = f"{WEBAPP_URL}?test_id={test_id}&user_id={callback.from_user.id}"
                
                # Check if URL is HTTPS (required by Telegram)
                use_webapp = webapp_url.startswith('https://')
                
                if use_webapp:
                    # Use WebApp button for HTTPS URLs
                    try:
                        keyboard = InlineKeyboardMarkup(inline_keyboard=[
                            [InlineKeyboardButton(
                                text="🚀 Testni boshlash",
                                web_app=WebAppInfo(url=webapp_url)
                            )]
                        ])
                        
                        await callback.message.edit_text(
                            f"📝 <b>{test_title}</b>\n\n"
                            f"{test_description}\n\n"
                            f"⏱ Vaqt: {time_limit} daqiqa\n\n"
                            f"Testni boshlash uchun quyidagi tugmani bosing:",
                            reply_markup=keyboard,
                            parse_mode="HTML"
                        )
                    except Exception as e:
                        logger.error(f"Error creating WebApp button: {e}")
                        # Fallback to text message
                        await callback.message.edit_text(
                            f"📝 <b>{test_title}</b>\n\n"
                            f"{test_description}\n\n"
                            f"⏱ Vaqt: {time_limit} daqiqa\n\n"
                            f"⚠️ Xatolik yuz berdi. Iltimos, keyinroq urinib ko'ring.",
                            parse_mode="HTML"
                        )
                else:
                    # HTTP URL uchun button o'rniga oddiy matn yuborish
                    # Telegram HTTP URL'larni button'da qabul qilmaydi
                    # Linkni HTML formatda yuborish (bosiladigan)
                    await callback.message.edit_text(
                        f"📝 <b>{test_title}</b>\n\n"
                        f"{test_description}\n\n"
                        f"⏱ Vaqt: {time_limit} daqiqa\n\n"
                        f"⚠️ <b>Development rejimida</b>\n\n"
                        f"Testni boshlash uchun quyidagi linkni bosing:\n"
                        f"<a href=\"{webapp_url}\">🚀 Testni boshlash</a>\n\n"
                        f"Yoki linkni nusxalab brauzerda oching:\n"
                        f"<code>{webapp_url}</code>",
                        parse_mode="HTML",
                        disable_web_page_preview=True
                    )
            else:
                await callback.answer("❌ Test topilmadi", show_alert=True)
    
    await callback.answer()


@dp.message(Command("menu"))
async def cmd_menu(message: types.Message):
    """Show main menu"""
    user = message.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    await show_main_menu(message, user_data)


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


@dp.callback_query(lambda c: c.data == "menu_back")
async def menu_back(callback: types.CallbackQuery):
    """Back to main menu"""
    user = callback.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    await callback.message.delete()
    await show_main_menu(callback.message, user_data)
    await callback.answer()


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
        types.BotCommand(command="apply", description="Test topshirish"),
        types.BotCommand(command="profile", description="Profilni tahrirlash"),
        types.BotCommand(command="results", description="Natijalarim"),
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

