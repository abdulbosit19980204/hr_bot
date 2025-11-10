import os
import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
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
storage = MemoryStorage()
dp = Dispatcher(storage=storage)


# States
class UserRegistration(StatesGroup):
    waiting_for_first_name = State()
    waiting_for_last_name = State()
    waiting_for_phone = State()
    waiting_for_email = State()
    waiting_for_position = State()


async def get_or_create_user(telegram_id: int, first_name: str, last_name: str = None):
    """Get or create user via API"""
    async with aiohttp.ClientSession() as session:
        # Try to get user by telegram_id
        async with session.get(f"{API_BASE_URL}/users/telegram_auth/", 
                              params={'telegram_id': telegram_id}) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get('user')
        
        # If not found, create new user
        user_data = {
            'username': f'user_{telegram_id}',
            'first_name': first_name,
            'last_name': last_name or '',
            'telegram_id': telegram_id,
        }
        
        async with session.post(f"{API_BASE_URL}/users/create_telegram_user/", 
                               json=user_data) as resp:
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
        await message.answer("Qaysi lavozimga ariza topshirmoqchisiz?")
        await state.set_state(UserRegistration.waiting_for_position)
    else:
        await message.answer("Iltimos, email manzilni to'g'ri kiriting.")


@dp.message(UserRegistration.waiting_for_position)
async def process_position(message: types.Message, state: FSMContext):
    """Process position and complete registration"""
    position = message.text
    data = await state.get_data()
    
    # Update user via API
    telegram_id = message.from_user.id
    user_data = {
        'first_name': data.get('first_name'),
        'last_name': data.get('last_name'),
        'phone': data.get('phone'),
        'email': data.get('email'),
        'position': position,
    }
    
    async with aiohttp.ClientSession() as session:
        # Try to update existing user or create new one
        async with session.post(
            f"{API_BASE_URL}/users/create_telegram_user/",
            json={
                'telegram_id': telegram_id,
                **user_data
            }
        ) as resp:
            if resp.status in [200, 201]:
                response_data = await resp.json()
                user = response_data.get('user', {})
                await message.answer(
                    "✅ Profilingiz muvaffaqiyatli to'ldirildi!\n\n"
                    "Endi testni boshlashingiz mumkin."
                )
                await show_main_menu(message, user)
            else:
                error_text = await resp.text()
                await message.answer(
                    f"❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.\n{error_text}"
                )
    
    await state.clear()


async def show_main_menu(message: types.Message, user_data: dict = None):
    """Show main menu with test button"""
    # Get available tests
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{API_BASE_URL}/tests/") as resp:
            if resp.status == 200:
                tests = await resp.json()
                if tests:
                    # Create keyboard with tests
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[])
                    
                    for test in tests[:5]:  # Show first 5 tests
                        test_id = test.get('id')
                        test_title = test.get('title', 'Test')
                        keyboard.inline_keyboard.append([
                            InlineKeyboardButton(
                                text=f"📝 {test_title}",
                                callback_data=f"test_{test_id}"
                            )
                        ])
                    
                    await message.answer(
                        "📋 Mavjud testlar:\n\n"
                        "Quyidagi testlardan birini tanlang:",
                        reply_markup=keyboard
                    )
                else:
                    await message.answer(
                        "ℹ️ Hozircha mavjud testlar yo'q.\n"
                        "Iltimos, keyinroq qayta urinib ko'ring."
                    )
            else:
                await message.answer(
                    "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
                )


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
            else:
                await callback.answer("❌ Test topilmadi", show_alert=True)
    
    await callback.answer()


@dp.message(Command("menu"))
async def cmd_menu(message: types.Message):
    """Show main menu"""
    user = message.from_user
    user_data = await get_or_create_user(user.id, user.first_name, user.last_name)
    await show_main_menu(message, user_data)


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
                results = await resp.json()
                if results:
                    text = "📊 Sizning test natijalaringiz:\n\n"
                    for result in results[:10]:  # Show last 10 results
                        test_title = result.get('test', {}).get('title', 'Test')
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


async def main():
    """Main function"""
    logger.info("Starting bot...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

