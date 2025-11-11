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

async def start_telegram_test(callback: types.CallbackQuery, state: FSMContext, notify_callback=None, notify_start_callback=None, notify_error_callback=None):
    """Start Telegram test"""
    test_id = callback.data.split("_")[-1]
    data = await state.get_data()
    test_data = data.get('test_data', {})
    
    # Check if this is a trial test
    is_trial = data.get('is_trial', False)
    
    # Get questions from API (with trial parameter)
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{API_BASE_URL}/tests/{test_id}/questions/",
            params={'trial': 'true' if is_trial else 'false', 'telegram_id': callback.from_user.id}
        ) as resp:
            logger.info(f"API response status: {resp.status}")
            if resp.status == 403:
                # User is blocked
                try:
                    error_data = await resp.json()
                    blocked_reason = error_data.get('reason', 'Noma\'lum sabab')
                except:
                    error_text = await resp.text()
                    blocked_reason = error_text if error_text else 'Noma\'lum sabab'
                
                logger.warning(f"User {callback.from_user.id} is blocked: {blocked_reason}")
                
                # Show user-friendly message
                await callback.message.edit_text(
                    f"⚠️ <b>Xatolik</b>\n\n"
                    f"❌ Siz block qilingansiz!\n\n"
                    f"📝 <b>Sabab:</b> {blocked_reason}\n\n"
                    f"Sizda test ishlash imkoniyati mavjud emas.\n\n"
                    f"Agar bu xato bo'lsa, iltimos admin bilan bog'laning.",
                    parse_mode="HTML"
                )
                await callback.answer("⚠️ Siz block qilingansiz!", show_alert=True)
                return
            
            if resp.status == 200:
                questions = await resp.json()
                logger.info(f"Received {len(questions)} questions")
                if not questions:
                    await callback.answer("❌ Testda savollar mavjud emas", show_alert=True)
                    return
                
                # Get test title
                test_title = test_data.get('title', 'Test')
                if is_trial:
                    test_title = f"🧪 Trial: {test_title}"
                
                # Get user data
                user_data = {
                    'telegram_id': callback.from_user.id,
                    'first_name': callback.from_user.first_name or '',
                    'last_name': callback.from_user.last_name or ''
                }
                
                # Notify admin about test start
                if notify_start_callback:
                    try:
                        await notify_start_callback(user_data, test_title, len(questions))
                    except Exception as e:
                        logger.error(f"Error notifying admin about test start: {e}", exc_info=True)
                
                # Save test data - IMPORTANT: Save telegram_id to state
                await state.update_data(
                    test_id=test_id,
                    questions=questions,
                    current_question=0,
                    answers=[],
                    start_time=datetime.now().timestamp(),
                    time_limit=test_data.get('time_limit', 60) * 60,  # Convert minutes to seconds
                    show_answers_immediately=test_data.get('show_answers_immediately', True),
                    is_trial=is_trial,
                    telegram_id=callback.from_user.id,  # Save user's telegram_id to state
                    test_data=test_data  # Save test_data for later use
                )
                logger.info(f"Test data saved to state, telegram_id: {callback.from_user.id}")
                
                # Save notify_error_callback to state
                await state.update_data(notify_error_callback=notify_error_callback)
                
                # Show first question
                await show_question(callback.message, state, 0, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
                await callback.answer()
            else:
                await callback.answer("❌ Xatolik yuz berdi", show_alert=True)


async def show_question(message: types.Message, state: FSMContext, question_index: int, notify_callback=None, notify_error_callback=None):
    """Show question to user"""
    data = await state.get_data()
    questions = data.get('questions', [])
    answers = data.get('answers', [])
    
    if question_index >= len(questions):
        # Test completed
        await complete_test(message, state, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
        return
    
    question = questions[question_index]
    question_text = question.get('text', '')
    options = question.get('options', [])
    
    # Calculate correct answers so far
    correct_count = 0
    for answer in answers:
        # Find the question and option
        for q in questions:
            if q.get('id') == answer.get('question_id'):
                for opt in q.get('options', []):
                    if opt.get('id') == answer.get('option_id') and opt.get('is_correct'):
                        correct_count += 1
                        break
                break
    
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
    
    # Add navigation buttons (Back and Home)
    navigation_buttons = []
    if question_index > 0:
        navigation_buttons.append(InlineKeyboardButton(text="⬅️ Orqaga", callback_data=f"back_question_{question_index - 1}"))
    navigation_buttons.append(InlineKeyboardButton(text="🏠 Bosh sahifa", callback_data="menu_back"))
    keyboard_buttons.append(navigation_buttons)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    
    # Save current state
    await state.update_data(current_question=question_index)
    
    # Show question with progress and stats
    text = f"❓ <b>Savol {question_index + 1}/{len(questions)}</b>\n"
    text += f"✅ <b>To'g'ri javoblar:</b> {correct_count}/{len(answers)} (jami {len(questions)} ta)\n\n"
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
    
    # Save answer (update if already exists for this question)
    question_id = question.get('id')
    # Remove existing answer for this question if any
    answers = [a for a in answers if a.get('question_id') != question_id]
    # Add new answer
    answers.append({
        'question_id': question_id,
        'option_id': option_id
    })
    # Save state with answers and current question
    await state.update_data(answers=answers, current_question=question_index)
    
    # Calculate correct answers so far (including current answer)
    is_correct = selected_option and selected_option.get('is_correct', False)
    correct_count = 0
    for answer in answers:
        # Find the question and option
        for q in questions:
            if q.get('id') == answer.get('question_id'):
                for opt in q.get('options', []):
                    if opt.get('id') == answer.get('option_id') and opt.get('is_correct'):
                        correct_count += 1
                        break
                break
    
    # Show feedback if enabled
    if show_answers_immediately:
        feedback_text = "✅ To'g'ri!" if is_correct else "❌ Noto'g'ri!"
        feedback_text += f"\n\n📊 To'g'ri javoblar: {correct_count}/{len(answers)}"
        
        if correct_option and not is_correct:
            correct_answer_text = correct_option.get('text', '')
            # Truncate long answers to prevent "text is too long" error
            # Telegram alert messages have a limit of 200 characters
            max_answer_length = 100  # Leave room for other text
            if len(correct_answer_text) > max_answer_length:
                correct_answer_text = correct_answer_text[:max_answer_length] + "..."
            feedback_text += f"\n\nTo'g'ri javob: {correct_answer_text}"
        
        # Ensure total feedback text doesn't exceed Telegram's 200 character limit for alerts
        if len(feedback_text) > 200:
            # Truncate to 200 characters
            feedback_text = feedback_text[:197] + "..."
        
        await callback.answer(feedback_text, show_alert=True)
    
    # Move to next question
    await asyncio.sleep(1 if show_answers_immediately else 0)
    # Get notify_callback from state if available
    notify_callback = data.get('notify_callback')
    notify_error_callback = data.get('notify_error_callback')
    await show_question(callback.message, state, question_index + 1, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
    await callback.answer()


async def complete_test(message: types.Message, state: FSMContext, notify_callback=None, notify_error_callback=None):
    """Complete test and send results"""
    data = await state.get_data()
    test_id = data.get('test_id')
    is_trial = data.get('is_trial', False)
    
    if not test_id:
        # Try to get test_id from test_data
        test_data = data.get('test_data', {})
        test_id = test_data.get('id')
    
    if not test_id:
        logger.error("test_id not found in state data")
        # Notify admin about error (but don't send result notification)
        if notify_error_callback:
            try:
                await notify_error_callback(
                    "Test ID topilmadi",
                    "complete_test funksiyasida test_id topilmadi",
                    user_id=message.from_user.id,
                    context={
                        'function': 'complete_test',
                        'state_data_keys': list(data.keys())
                    }
                )
            except Exception as e:
                logger.error(f"Error notifying admin about test_id error: {e}", exc_info=True)
        
        await message.edit_text("❌ Xatolik: Test ID topilmadi. Iltimos, qaytadan urinib ko'ring.")
        await state.clear()
        return
    
    test_data = data.get('test_data', {})
    answers = data.get('answers', [])
    start_time = data.get('start_time', datetime.now().timestamp())
    
    # Get telegram_id from state or message
    # IMPORTANT: message.from_user.id might be bot's ID if message is from bot
    # So we should get telegram_id from state where we saved it during test start
    telegram_id = data.get('telegram_id')
    if not telegram_id:
        # Fallback to message.from_user.id if not in state
        telegram_id = message.from_user.id
        logger.warning(f"telegram_id not found in state, using message.from_user.id: {telegram_id}")
    else:
        logger.info(f"Using telegram_id from state: {telegram_id}")
    
    # Calculate time taken
    time_taken = int(datetime.now().timestamp() - start_time)
    
    # Get test title
    test_title = test_data.get('title', 'Test')
    
    # Check if this is bot's own telegram_id (prevent bot from taking tests)
    # Get bot's own ID from environment or bot.get_me()
    try:
        bot_token = os.getenv('TELEGRAM_BOT_TOKEN', '')
        if bot_token:
            # Get bot info from API
            async with aiohttp.ClientSession() as check_session:
                async with check_session.get(f"https://api.telegram.org/bot{bot_token}/getMe") as bot_resp:
                    if bot_resp.status == 200:
                        bot_data = await bot_resp.json()
                        if bot_data.get('ok') and bot_data.get('result', {}).get('id') == telegram_id:
                            logger.warning(f"Bot tried to take test with its own telegram_id: {telegram_id}")
                            await message.edit_text("❌ Xatolik: Bot o'zi test yubora olmaydi.")
                            await state.clear()
                            return
    except Exception as e:
        logger.warning(f"Could not check bot ID: {e}")
    
    # Get user data
    user_data = {
        'telegram_id': telegram_id,
        'first_name': message.from_user.first_name or '',
        'last_name': message.from_user.last_name or ''
    }
    
    # Send test result to API
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_BASE_URL}/results/",
            json={
                'test_id': test_id,
                'answers': answers,
                'time_taken': time_taken,
                'telegram_id': telegram_id,
                'is_trial': is_trial
            }
        ) as resp:
            if resp.status == 201:
                result = await resp.json()
                score = result.get('score', 0)
                total_questions = result.get('total_questions', 0)
                correct_answers = result.get('correct_answers', 0)
                is_passed = result.get('is_passed', False)
                requires_cv = result.get('requires_cv', False)
                
                # Notify admin about test result
                if notify_callback:
                    try:
                        await notify_callback(user_data, test_title, result)
                    except Exception as e:
                        logger.error(f"Error notifying admin about test result: {e}", exc_info=True)
                
                # Show results - limit message length to avoid "text is too long" error
                # Telegram allows max 4096 characters per message
                trial_prefix = "🧪 " if is_trial else ""
                text = f"{trial_prefix}📊 <b>Test natijalari</b>\n\n"
                text += f"📝 Jami: {total_questions} | ✅ To'g'ri: {correct_answers} | 📈 Ball: {score}%\n\n"
                
                # Get detailed answers from result (limit to avoid message too long)
                result_answers = result.get('answers', [])
                if result_answers and len(result_answers) > 0:
                    # Show first 5 questions to save space
                    max_questions_to_show = min(5, len(result_answers))
                    text += "<b>Savollar va javoblar:</b>\n\n"
                    for idx, answer_data in enumerate(result_answers[:max_questions_to_show], 1):
                        question_data = answer_data.get('question', {})
                        selected_option = answer_data.get('selected_option', {})
                        is_correct = answer_data.get('is_correct', False)
                        
                        question_text = question_data.get('text', 'Savol')
                        option_text = selected_option.get('text', 'Javob topilmadi')
                        
                        # Truncate long texts to save space
                        if len(question_text) > 35:
                            question_text = question_text[:35] + "..."
                        if len(option_text) > 25:
                            option_text = option_text[:25] + "..."
                        
                        status_icon = "✅" if is_correct else "❌"
                        text += f"{idx}. {status_icon} {question_text}\n"
                        text += f"   {option_text}\n\n"
                        
                        # Check if message is getting too long
                        if len(text) > 3500:
                            break
                    
                    if len(result_answers) > max_questions_to_show:
                        remaining = len(result_answers) - max_questions_to_show
                        text += f"... va yana {remaining} ta savol\n\n"
                
                # Get passing score from test_data
                passing_score = test_data.get('passing_score', 60) if test_data else 60
                
                if is_passed:
                    text += "✅ <b>Tabriklaymiz! Testdan o'tdingiz!</b>"
                    if requires_cv and not is_trial:
                        text += "\n\n📄 CV yuklash: /upload_cv yoki Menu'dan CV yuklash tugmasini bosing"
                else:
                    # Check if score is low but not zero
                    if score > 0 and score < passing_score:
                        text += "❌ Testdan o'ta olmadingiz.\n\n"
                        text += "💡 Iltimos, malakangizni oshirib bizni keyingi vakansiyalarimiz uchun ariza qoldirasiz deb umid qilamiz!"
                    else:
                        text += "❌ Testdan o'ta olmadingiz."
                        if not is_trial:
                            text += " Keyingi safar yanada yaxshi natija olishga harakat qiling!"
                
                # Ensure message is not too long (Telegram limit: 4096 chars)
                if len(text) > 4096:
                    text = text[:4000] + "\n\n... (xabar qisqartirildi)"
                
                keyboard = InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="🔙 Asosiy menyu", callback_data="menu_back")]
                ])
                
                logger.info(f"Displaying test results (message length: {len(text)} chars)")
                try:
                    await message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
                except Exception as e:
                    logger.error(f"Error displaying results: {e}", exc_info=True)
                    # Try sending as new message if edit fails
                    try:
                        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                    except Exception as e2:
                        logger.error(f"Error sending results as new message: {e2}", exc_info=True)
                        # Send simplified message
                        simple_text = (
                            f"{trial_prefix}📊 <b>Test natijalari</b>\n\n"
                            f"📝 Jami: {total_questions} | ✅ To'g'ri: {correct_answers} | 📈 Ball: {score}%\n\n"
                        )
                        if is_passed:
                            simple_text += "✅ <b>Tabriklaymiz! Testdan o'tdingiz!</b>"
                        else:
                            simple_text += "❌ Testdan o'ta olmadingiz."
                        await message.answer(simple_text, reply_markup=keyboard, parse_mode="HTML")
                
                # Request CV upload if passed (not for trial tests)
                if is_passed and requires_cv and not is_trial:
                    await asyncio.sleep(2)
                    await request_cv_upload(message, state)
            else:
                error_text = await resp.text()
                error_data = await resp.json() if resp.content_type == 'application/json' else {}
                error_message = error_data.get('error', error_data.get('detail', error_text))
                logger.error(f"Error submitting test: {error_text}, status: {resp.status}")
                
                # Notify admin about error
                if notify_error_callback:
                    try:
                        await notify_error_callback(
                            "Test natijasini yuborish xatoligi",
                            str(error_message),
                            user_id=telegram_id,
                            context={
                                'test_id': test_id,
                                'test_title': test_title,
                                'status_code': resp.status,
                                'function': 'complete_test'
                            }
                        )
                    except Exception as e:
                        logger.error(f"Error notifying admin about test submission error: {e}", exc_info=True)
                
                await message.edit_text(
                    f"❌ Xatolik yuz berdi: {error_message}\n\nIltimos, keyinroq urinib ko'ring.",
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

