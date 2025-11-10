"""Telegram test handlers"""
import os
import aiohttp
import asyncio
from datetime import datetime
from aiogram import types
from aiogram.fsm.context import FSMContext
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000/api')

async def start_telegram_test(callback: types.CallbackQuery, state: FSMContext):
    """Start Telegram test"""
    test_id = callback.data.split("_")[-1]
    data = await state.get_data()
    test_data = data.get('test_data', {})
    
    # Get questions from API
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{API_BASE_URL}/tests/{test_id}/questions/") as resp:
            if resp.status == 200:
                questions = await resp.json()
                if not questions:
                    await callback.answer("❌ Testda savollar mavjud emas", show_alert=True)
                    return
                
                # Save test data
                await state.update_data(
                    test_id=test_id,
                    questions=questions,
                    current_question=0,
                    answers=[],
                    start_time=datetime.now().timestamp(),
                    show_answers_immediately=test_data.get('show_answers_immediately', True)
                )
                
                # Show first question
                await show_question(callback.message, state, 0)
                await callback.answer()
            else:
                await callback.answer("❌ Xatolik yuz berdi", show_alert=True)


async def show_question(message: types.Message, state: FSMContext, question_index: int):
    """Show question to user"""
    data = await state.get_data()
    questions = data.get('questions', [])
    
    if question_index >= len(questions):
        # Test completed
        await complete_test(message, state)
        return
    
    question = questions[question_index]
    question_text = question.get('text', '')
    options = question.get('options', [])
    
    # Create keyboard with options
    keyboard_buttons = []
    for option in options:
        option_text = option.get('text', '')
        option_id = option.get('id')
        keyboard_buttons.append([
            InlineKeyboardButton(
                text=option_text,
                callback_data=f"answer_{question_index}_{option_id}"
            )
        ])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    
    # Show question
    text = f"❓ <b>Savol {question_index + 1}/{len(questions)}</b>\n\n"
    text += f"{question_text}"
    
    await message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")


async def process_answer(callback: types.CallbackQuery, state: FSMContext):
    """Process user's answer"""
    parts = callback.data.split("_")
    question_index = int(parts[1])
    option_id = int(parts[2])
    
    data = await state.get_data()
    questions = data.get('questions', [])
    answers = data.get('answers', [])
    show_answers_immediately = data.get('show_answers_immediately', True)
    
    if question_index >= len(questions):
        await callback.answer("❌ Xatolik", show_alert=True)
        return
    
    question = questions[question_index]
    options = question.get('options', [])
    
    # Find selected option
    selected_option = None
    correct_option = None
    for option in options:
        if option.get('id') == option_id:
            selected_option = option
        if option.get('is_correct'):
            correct_option = option
    
    # Save answer
    answers.append({
        'question_id': question.get('id'),
        'option_id': option_id
    })
    await state.update_data(answers=answers)
    
    # Show feedback if enabled
    if show_answers_immediately:
        is_correct = selected_option and selected_option.get('is_correct', False)
        feedback_text = "✅ To'g'ri!" if is_correct else "❌ Noto'g'ri!"
        
        if correct_option and not is_correct:
            feedback_text += f"\n\nTo'g'ri javob: {correct_option.get('text', '')}"
        
        await callback.answer(feedback_text, show_alert=True)
    
    # Move to next question
    await asyncio.sleep(1 if show_answers_immediately else 0)
    await show_question(callback.message, state, question_index + 1)
    await callback.answer()


async def complete_test(message: types.Message, state: FSMContext):
    """Complete test and send results"""
    data = await state.get_data()
    test_id = data.get('test_id')
    answers = data.get('answers', [])
    start_time = data.get('start_time', datetime.now().timestamp())
    telegram_id = message.from_user.id
    
    # Calculate time taken
    time_taken = int(datetime.now().timestamp() - start_time)
    
    # Send test result to API
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_BASE_URL}/results/",
            json={
                'test_id': test_id,
                'answers': answers,
                'time_taken': time_taken,
                'telegram_id': telegram_id
            }
        ) as resp:
            if resp.status == 201:
                result = await resp.json()
                score = result.get('score', 0)
                total_questions = result.get('total_questions', 0)
                correct_answers = result.get('correct_answers', 0)
                is_passed = result.get('is_passed', False)
                requires_cv = result.get('requires_cv', False)
                
                # Show results
                text = "📊 <b>Test natijalari</b>\n\n"
                text += f"📝 Jami savollar: {total_questions}\n"
                text += f"✅ To'g'ri javoblar: {correct_answers}\n"
                text += f"📈 Ball: {score}%\n\n"
                
                if is_passed:
                    text += "✅ <b>Tabriklaymiz! Siz testdan o'tdingiz!</b>\n\n"
                    if requires_cv:
                        text += "📄 CV yuklash uchun tayyor bo'ling.\n"
                        text += "CV yuklash uchun /upload_cv buyrug'ini yuboring."
                else:
                    text += "❌ Afsus, siz testdan o'ta olmadingiz.\n"
                    text += "Keyingi safar yanada yaxshi natija olishga harakat qiling!"
                
                keyboard = InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="🔙 Asosiy menyu", callback_data="menu_back")]
                ])
                
                await message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
                
                # Request CV upload if passed
                if is_passed and requires_cv:
                    await asyncio.sleep(2)
                    await request_cv_upload(message, state)
            else:
                error_text = await resp.text()
                logger.error(f"Error submitting test: {error_text}")
                await message.edit_text(
                    "❌ Xatolik yuz berdi. Iltimos, keyinroq urinib ko'ring.",
                    parse_mode="HTML"
                )
    
    # Clear state
    await state.clear()


async def request_cv_upload(message: types.Message, state: FSMContext):
    """Request CV upload from user"""
    text = (
        "📄 <b>CV yuklash</b>\n\n"
        "Siz testdan muvaffaqiyatli o'tdingiz!\n"
        "CV yuklash uchun quyidagi buyruqni yuboring:\n\n"
        "<code>/upload_cv</code>\n\n"
        "Yoki CV faylini yuboring."
    )
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📄 CV yuklash", callback_data="upload_cv")],
        [InlineKeyboardButton(text="🔙 Keyinroq", callback_data="skip_cv")]
    ])
    
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")

