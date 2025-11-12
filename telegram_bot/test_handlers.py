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

async def time_checker_task(message: types.Message, state: FSMContext, notify_callback=None, notify_error_callback=None):
    """Background task to check time limit periodically and update time display"""
    try:
        while True:
            await asyncio.sleep(5)  # Check every 5 seconds
            
            data = await state.get_data()
            
            # Check if test is completed
            if data.get('test_completed', False):
                break
            
            # Get callbacks from state if not provided
            if notify_callback is None:
                notify_callback = data.get('notify_callback')
            if notify_error_callback is None:
                notify_error_callback = data.get('notify_error_callback')
            
            # Check time limit
            time_expired = await check_time_limit(message, state, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
            if time_expired:
                # Time expired, test completed by check_time_limit
                # complete_test is already called in check_time_limit
                break
            
            # Update message with current time if test is still active
            current_question = data.get('current_question', 0)
            questions = data.get('questions', [])
            if questions and current_question < len(questions):
                # Update time display in the current question
                try:
                    await show_question(message, state, current_question, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
                except Exception as e:
                    error_msg = str(e)
                    # Check if it's "message is not modified" error - ignore it
                    if "message is not modified" in error_msg.lower():
                        # Message is the same, continue checking
                        continue
                    logger.error(f"Error updating time display: {e}", exc_info=True)
                    # If message update fails, test might be completed or message deleted
                    break
    except asyncio.CancelledError:
        logger.info("Time checker task cancelled")
        # When cancelled, check if test needs to be completed
        # This can happen if time limit is reached or test is manually completed
        data = await state.get_data()
        if not data.get('test_completed', False):
            # Test not completed yet, check time limit one more time
            try:
                # Get callbacks from state
                notify_callback = data.get('notify_callback')
                notify_error_callback = data.get('notify_error_callback')
                
                # Check time limit one final time
                time_expired = await check_time_limit(message, state, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
                if not time_expired:
                    # Time not expired, but task was cancelled - complete test anyway
                    # This ensures test results are saved even if task is cancelled unexpectedly
                    logger.info("Time checker task cancelled but test not completed, completing test now")
                    await complete_test(message, state, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
            except Exception as e:
                logger.error(f"Error completing test after cancellation: {e}", exc_info=True)
    except Exception as e:
        logger.error(f"Error in time checker task: {e}", exc_info=True)


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
            
            if resp.status == 400:
                # Attempts limit reached
                try:
                    error_data = await resp.json()
                    error_message = error_data.get('message', error_data.get('error', 'Urinishlar soni tugagan'))
                    attempts_used = error_data.get('attempts_used', 0)
                    max_attempts = error_data.get('max_attempts') or error_data.get('max_trial_attempts', 0)
                    
                    # Show user-friendly message with attempts info
                    if is_trial:
                        message_text = (
                            f"⚠️ <b>Trial test urinishlari tugagan</b>\n\n"
                            f"📊 <b>Ishlangan:</b> {attempts_used} marta\n"
                            f"📈 <b>Ruxsat etilgan:</b> {max_attempts} marta\n\n"
                            f"Siz trial testni {attempts_used} marta ishlagansiz va ruxsat etilgan urinishlar soni ({max_attempts}) tugagan."
                        )
                    else:
                        message_text = (
                            f"⚠️ <b>Test urinishlari tugagan</b>\n\n"
                            f"📊 <b>Ishlangan:</b> {attempts_used} marta\n"
                            f"📈 <b>Ruxsat etilgan:</b> {max_attempts} marta\n\n"
                            f"Siz bu testni {attempts_used} marta ishlagansiz va ruxsat etilgan urinishlar soni ({max_attempts}) tugagan."
                        )
                    
                    await callback.message.edit_text(message_text, parse_mode="HTML")
                    await callback.answer(error_message, show_alert=True)
                except Exception as e:
                    logger.error(f"Error handling 400 response: {e}", exc_info=True)
                    await callback.answer("❌ Xatolik yuz berdi", show_alert=True)
                return
            
            if resp.status == 200:
                questions = await resp.json()
                logger.info(f"Received {len(questions)} questions")
                if not questions:
                    await callback.answer("❌ Testda savollar mavjud emas", show_alert=True)
                    return
                
                # Get test title and description
                test_title = test_data.get('title', 'Test')
                test_description = test_data.get('description', '')
                if is_trial:
                    test_title = f"🧪 Trial: {test_title}"
                
                # Get user data from API (to ensure we have correct user info)
                user_data = None
                async with aiohttp.ClientSession() as user_session:
                    async with user_session.post(
                        f"{API_BASE_URL}/users/telegram_auth/",
                        json={
                            'telegram_id': callback.from_user.id,
                            'first_name': callback.from_user.first_name or '',
                            'last_name': callback.from_user.last_name or ''
                        }
                    ) as user_resp:
                        if user_resp.status in [200, 201]:
                            user_response = await user_resp.json()
                            user_data = user_response.get('user', {})
                            # Ensure we have correct user data
                            if user_data:
                                # TelegramProfile'dan ism/familiyani olish (User table'dan emas)
                                telegram_profile = user_data.get('telegram_profile', {})
                                if telegram_profile:
                                    telegram_first_name = telegram_profile.get('telegram_first_name', '')
                                    telegram_last_name = telegram_profile.get('telegram_last_name', '')
                                    # Agar telegram_profile'da ism bo'lsa, user_data'ga qo'shish
                                    if telegram_first_name:
                                        user_data['telegram_first_name'] = telegram_first_name
                                    if telegram_last_name:
                                        user_data['telegram_last_name'] = telegram_last_name
                                
                                # Fallback: agar telegram_profile bo'sh bo'lsa, callback'dan olish
                                if not telegram_profile or not telegram_profile.get('telegram_first_name'):
                                    if callback.from_user.first_name:
                                        user_data['telegram_first_name'] = callback.from_user.first_name
                                    if callback.from_user.last_name:
                                        user_data['telegram_last_name'] = callback.from_user.last_name
                
                # If user_data not found or invalid, use fallback
                if not user_data or not user_data.get('telegram_profile'):
                    user_data = {
                        'telegram_id': callback.from_user.id,
                        'telegram_first_name': callback.from_user.first_name or 'User',
                        'telegram_last_name': callback.from_user.last_name or '',
                        'telegram_profile': {
                            'telegram_first_name': callback.from_user.first_name or '',
                            'telegram_last_name': callback.from_user.last_name or ''
                        }
                    }
                
                # Notify admin about test start (with test description)
                if notify_start_callback:
                    try:
                        await notify_start_callback(user_data, test_title, len(questions), test_description)
                    except Exception as e:
                        logger.error(f"Error notifying admin about test start: {e}", exc_info=True)
                
                # Save test data - IMPORTANT: Save telegram_id to state
                # Clear test_completed flag when starting new test
                # First, clear any existing test state to ensure clean start
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
                    test_data=test_data,  # Save test_data for later use
                    test_completed=False  # Reset test_completed flag when starting new test
                )
                logger.info(f"Test data saved to state, telegram_id: {callback.from_user.id}, test_completed=False")
                
                # Save notify_error_callback to state
                await state.update_data(notify_error_callback=notify_error_callback)
                
                # Start background task to check time limit periodically
                task = asyncio.create_task(
                    time_checker_task(callback.message, state, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
                )
                # Save task to state so we can cancel it later if needed
                await state.update_data(time_checker_task=task)
                
                # Ensure test_completed is False before showing question
                await state.update_data(test_completed=False)
                
                # Show first question
                await show_question(callback.message, state, 0, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
                await callback.answer()
            else:
                await callback.answer("❌ Xatolik yuz berdi", show_alert=True)


async def check_time_limit(message: types.Message, state: FSMContext, notify_callback=None, notify_error_callback=None):
    """Check if time limit has been reached and complete test if needed"""
    data = await state.get_data()
    
    # Check if test is already completed
    if data.get('test_completed', False):
        return False
    
    start_time = data.get('start_time')
    time_limit = data.get('time_limit', 60 * 60)
    
    if not start_time:
        return False
    
    elapsed_time = datetime.now().timestamp() - start_time
    remaining_time = time_limit - elapsed_time
    
    # If time is up, complete the test
    if remaining_time <= 0:
        logger.info(f"Time limit reached for test {data.get('test_id')}, completing test automatically")
        
        # Cancel background time checker task if exists
        time_checker_task = data.get('time_checker_task')
        if time_checker_task and not time_checker_task.done():
            try:
                time_checker_task.cancel()
                logger.info("Time checker task cancelled")
            except Exception as e:
                logger.error(f"Error cancelling time checker task: {e}", exc_info=True)
        
        # Show message to user that time is up
        try:
            await message.edit_text(
                "⏰ <b>Vaqt tugadi!</b>\n\n"
                "Test avtomatik yakunlandi. Natijalar hisoblanmoqda...",
                parse_mode="HTML"
            )
        except Exception as e:
            logger.error(f"Error showing time expired message: {e}", exc_info=True)
            # Try to send as new message if edit fails
            try:
                await message.answer(
                    "⏰ <b>Vaqt tugadi!</b>\n\n"
                    "Test avtomatik yakunlandi. Natijalar hisoblanmoqda...",
                    parse_mode="HTML"
                )
            except Exception as e2:
                logger.error(f"Error sending time expired message: {e2}", exc_info=True)
        
        # Complete the test - ensure results are saved and sent to chat
        # NOTE: Don't set test_completed=True here, let complete_test do it
        logger.info("Calling complete_test from check_time_limit")
        await complete_test(message, state, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
        return True
    
    return False


async def show_question(message: types.Message, state: FSMContext, question_index: int, notify_callback=None, notify_error_callback=None):
    """Show question to user"""
    data = await state.get_data()
    
    # Check if test is already completed
    test_completed = data.get('test_completed', False)
    logger.info(f"show_question called: question_index={question_index}, test_completed={test_completed}, test_id={data.get('test_id')}")
    
    if test_completed:
        logger.info("Test already completed, skipping show_question")
        return
    
    # Check time limit first
    time_expired = await check_time_limit(message, state, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
    if time_expired:
        return
    
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
    
    # Calculate time progress
    start_time = data.get('start_time', datetime.now().timestamp())
    time_limit = data.get('time_limit', 60 * 60)  # Default 60 minutes in seconds
    elapsed_time = datetime.now().timestamp() - start_time
    remaining_time = max(0, time_limit - elapsed_time)
    
    # Calculate progress percentage (0-100)
    progress_percentage = min(100, max(0, int((elapsed_time / time_limit) * 100))) if time_limit > 0 else 0
    
    # Create progress bar (20 characters)
    progress_bar_length = 20
    filled = int((progress_percentage / 100) * progress_bar_length)
    empty = progress_bar_length - filled
    progress_bar = "█" * filled + "░" * empty
    
    # Format time
    remaining_minutes = int(remaining_time // 60)
    remaining_seconds = int(remaining_time % 60)
    elapsed_minutes = int(elapsed_time // 60)
    elapsed_seconds = int(elapsed_time % 60)
    total_minutes = int(time_limit // 60)
    
    # Show question with progress and stats
    text = f"❓ <b>Savol {question_index + 1}/{len(questions)}</b>\n"
    text += f"✅ <b>To'g'ri javoblar:</b> {correct_count}/{len(answers)} (jami {len(questions)} ta)\n\n"
    text += f"⏱️ <b>Vaqt:</b> {elapsed_minutes}:{elapsed_seconds:02d} / {total_minutes}:00\n"
    text += f"⏳ <b>Qolgan vaqt:</b> {remaining_minutes}:{remaining_seconds:02d}\n"
    text += f"📊 <b>Progress:</b> {progress_bar} {progress_percentage}%\n\n"
    text += f"{question_text}"
    
    await message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")


async def process_answer(callback: types.CallbackQuery, state: FSMContext):
    """Process user's answer"""
    data = await state.get_data()
    
    # Check if test is already completed
    if data.get('test_completed', False):
        await callback.answer("⚠️ Test allaqachon yakunlangan", show_alert=True)
        return
    
    # Check time limit first
    time_expired = await check_time_limit(callback.message, state, notify_callback=data.get('notify_callback'), notify_error_callback=data.get('notify_error_callback'))
    if time_expired:
        await callback.answer("⏰ Vaqt tugadi! Test avtomatik yakunlandi.", show_alert=True)
        return
    
    parts = callback.data.split("_")
    question_index = int(parts[1])
    option_id = int(parts[2])
    
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
    
    # Check time limit again before showing next question
    time_expired = await check_time_limit(callback.message, state, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
    if time_expired:
        return
    
    # Check if this is the last question before showing next
    if question_index + 1 >= len(questions):
        # This is the last question, complete test
        # Check again if test is already completed (race condition protection)
        current_data = await state.get_data()
        if not current_data.get('test_completed', False):
            await complete_test(callback.message, state, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
    else:
        # Show next question
        await show_question(callback.message, state, question_index + 1, notify_callback=notify_callback, notify_error_callback=notify_error_callback)
    
    # Only answer callback if not already answered
    if not show_answers_immediately:
        await callback.answer()


async def complete_test(message: types.Message, state: FSMContext, notify_callback=None, notify_error_callback=None):
    """Complete test and send results"""
    data = await state.get_data()
    
    # Check if test is already completed to prevent duplicate submissions
    if data.get('test_completed', False):
        logger.info("Test already completed, skipping duplicate completion")
        return
    
    # Mark test as completed immediately to prevent duplicate calls
    await state.update_data(test_completed=True)
    
    # Cancel background time checker task if exists (but don't wait for it)
    time_checker_task = data.get('time_checker_task')
    if time_checker_task and not time_checker_task.done():
        try:
            time_checker_task.cancel()
            logger.info("Time checker task cancelled")
        except Exception as e:
            logger.error(f"Error cancelling time checker task: {e}", exc_info=True)
    
    test_id = data.get('test_id')
    is_trial = data.get('is_trial', False)
    
    if not test_id:
        # Try to get test_id from test_data
        test_data = data.get('test_data', {})
        test_id = test_data.get('id')
    
    if not test_id:
        logger.error("test_id not found in state data")
        # Log all state keys for debugging
        logger.error(f"State data keys: {list(data.keys())}")
        logger.error(f"State data: {data}")
        
        # Notify admin about error (but don't send result notification)
        if notify_error_callback:
            try:
                await notify_error_callback(
                    "Test ID topilmadi",
                    "complete_test funksiyasida test_id topilmadi",
                    user_id=telegram_id,  # Use telegram_id from state, not message.from_user.id
                    context={
                        'function': 'complete_test',
                        'state_data_keys': list(data.keys()),
                        'telegram_id': telegram_id
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
    
    # Log answers count for debugging
    logger.info(f"Completing test {test_id}, answers count: {len(answers)}, is_trial: {is_trial}")
    
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
    
    # Get user data from API (to ensure we have correct user info)
    user_data = None
    async with aiohttp.ClientSession() as session:
        # First, get user data from API
        async with session.post(
            f"{API_BASE_URL}/users/telegram_auth/",
            json={
                'telegram_id': telegram_id,
                'first_name': message.from_user.first_name or '',
                'last_name': message.from_user.last_name or ''
            }
        ) as user_resp:
            if user_resp.status in [200, 201]:
                user_response = await user_resp.json()
                user_data = user_response.get('user', {})
                # Ensure we have correct user data
                if user_data:
                    # TelegramProfile'dan ism/familiyani olish (User table'dan emas)
                    telegram_profile = user_data.get('telegram_profile', {})
                    if telegram_profile:
                        telegram_first_name = telegram_profile.get('telegram_first_name', '')
                        telegram_last_name = telegram_profile.get('telegram_last_name', '')
                        # Agar telegram_profile'da ism bo'lsa, user_data'ga qo'shish
                        if telegram_first_name:
                            user_data['telegram_first_name'] = telegram_first_name
                        if telegram_last_name:
                            user_data['telegram_last_name'] = telegram_last_name
                    
                    # Fallback: agar telegram_profile bo'sh bo'lsa, message'dan olish
                    if not telegram_profile or not telegram_profile.get('telegram_first_name'):
                        if message.from_user.first_name:
                            user_data['telegram_first_name'] = message.from_user.first_name
                        if message.from_user.last_name:
                            user_data['telegram_last_name'] = message.from_user.last_name
                    logger.info(f"Retrieved user data from API: {user_data.get('telegram_profile', {}).get('telegram_first_name', 'N/A')} (telegram_id: {telegram_id})")
        
        # If user_data not found or invalid, use fallback
        if not user_data or not user_data.get('telegram_profile'):
            user_data = {
                'telegram_id': telegram_id,
                'telegram_first_name': message.from_user.first_name or 'User',
                'telegram_last_name': message.from_user.last_name or '',
                'telegram_profile': {
                    'telegram_first_name': message.from_user.first_name or '',
                    'telegram_last_name': message.from_user.last_name or ''
                }
            }
            logger.warning(f"User data not found or invalid in API, using fallback: {user_data}")
        
        # Send test result to API
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
                
                # Notify admin about test result (use user_data from API)
                if notify_callback:
                    try:
                        await notify_callback(user_data, test_title, result)
                    except Exception as e:
                        logger.error(f"Error notifying admin about test result: {e}", exc_info=True)
                
                # Show results - send all answers, split into multiple messages if needed
                # Telegram allows max 4096 characters per message
                trial_prefix = "🧪 " if is_trial else ""
                
                # First message: Summary
                summary_text = f"{trial_prefix}📊 <b>Test natijalari</b>\n\n"
                summary_text += f"📝 Jami: {total_questions} | ✅ To'g'ri: {correct_answers} | 📈 Ball: {score}%\n\n"
                
                # Get passing score from test_data
                passing_score = test_data.get('passing_score', 60) if test_data else 60
                
                if is_passed:
                    summary_text += "✅ <b>Tabriklaymiz! Testdan o'tdingiz!</b>"
                    if requires_cv and not is_trial:
                        summary_text += "\n\n📄 CV yuklash: /upload_cv yoki Menu'dan CV yuklash tugmasini bosing"
                else:
                    # Check if score is low but not zero
                    if score > 0 and score < passing_score:
                        summary_text += "❌ Testdan o'ta olmadingiz.\n\n"
                        summary_text += "💡 Iltimos, malakangizni oshirib bizni keyingi vakansiyalarimiz uchun ariza qoldirasiz deb umid qilamiz!"
                    else:
                        summary_text += "❌ Testdan o'ta olmadingiz."
                        if not is_trial:
                            summary_text += " Keyingi safar yanada yaxshi natija olishga harakat qiling!"
                
                keyboard = InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="🔙 Asosiy menyu", callback_data="menu_back")]
                ])
                
                # Send summary message first
                try:
                    await message.edit_text(summary_text, reply_markup=keyboard, parse_mode="HTML")
                except Exception as e:
                    error_msg = str(e)
                    if "message is not modified" not in error_msg.lower():
                        logger.error(f"Error displaying summary: {e}", exc_info=True)
                        try:
                            await message.answer(summary_text, reply_markup=keyboard, parse_mode="HTML")
                        except Exception as e2:
                            logger.error(f"Error sending summary as new message: {e2}", exc_info=True)
                
                # Send detailed answers in separate messages
                result_answers = result.get('answers', [])
                if result_answers and len(result_answers) > 0:
                    # Group answers into messages (max 4000 chars per message to be safe)
                    current_message = "<b>📋 Savollar va javoblar:</b>\n\n"
                    message_count = 0
                    max_message_length = 4000
                    
                    for idx, answer_data in enumerate(result_answers, 1):
                        question_data = answer_data.get('question', {})
                        selected_option = answer_data.get('selected_option', {})
                        is_correct = answer_data.get('is_correct', False)
                        
                        question_text = question_data.get('text', 'Savol')
                        option_text = selected_option.get('text', 'Javob topilmadi')
                        
                        # Format answer line
                        status_icon = "✅" if is_correct else "❌"
                        answer_line = f"{idx}. {status_icon} <b>{question_text}</b>\n"
                        answer_line += f"   Javob: {option_text}\n\n"
                        
                        # Check if adding this answer would exceed message limit
                        if len(current_message) + len(answer_line) > max_message_length:
                            # Send current message and start new one
                            try:
                                await message.answer(current_message, parse_mode="HTML")
                                message_count += 1
                            except Exception as e:
                                logger.error(f"Error sending answer message {message_count + 1}: {e}", exc_info=True)
                            
                            # Start new message
                            current_message = f"<b>📋 Savollar va javoblar (davomi):</b>\n\n"
                            current_message += answer_line
                        else:
                            current_message += answer_line
                    
                    # Send remaining answers if any
                    if len(current_message) > len("<b>📋 Savollar va javoblar (davomi):</b>\n\n"):
                        try:
                            await message.answer(current_message, parse_mode="HTML")
                            message_count += 1
                        except Exception as e:
                            logger.error(f"Error sending final answer message: {e}", exc_info=True)
                    
                    logger.info(f"Sent {message_count} detailed answer messages")
                
                # Send additional message after answers (for both passed and failed tests)
                await asyncio.sleep(1)  # Small delay before sending additional message
                
                if is_passed:
                    # Success message with CV upload request
                    success_message = (
                        "🎉 <b>Tabriklaymiz!</b>\n\n"
                        "Siz testdan muvaffaqiyatli o'tdingiz!\n\n"
                        "📄 Iltimos, bizga CV yingizni yuboring.\n\n"
                        "CV yuklash uchun:\n"
                        "• Menu'dan \"📄 CV yuklash\" tugmasini bosing\n"
                        "• Yoki <code>/upload_cv</code> buyrug'ini yuboring\n"
                        "• Yoki CV faylini to'g'ridan-to'g'ri yuboring"
                    )
                    
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="📄 CV yuklash", callback_data="upload_cv")],
                        [InlineKeyboardButton(text="🔙 Asosiy menyu", callback_data="menu_back")]
                    ])
                    
                    try:
                        await message.answer(success_message, reply_markup=keyboard, parse_mode="HTML")
                    except Exception as e:
                        logger.error(f"Error sending success message: {e}", exc_info=True)
                else:
                    # Motivational message for failed tests
                    motivational_message = (
                        "💪 <b>Sizga katta rahmat!</b>\n\n"
                        "Hozircha tajriba biroz yetishmasligi tabiiy holat — har bir muvaffaqiyat yo'li aynan shunday boshlanadi.\n\n"
                        "Muhimi, sizda o'sishga bo'lgan ishtiyoq va qat'iyat bor.\n\n"
                        "Ishonamizki, yaqin kelajakda siz yanada kuchli mutaxassis sifatida qayta uchrashamiz.\n\n"
                        "🎯 Malakangizni oshirishda davom eting — keyingi safar albatta yanada yuqori natijaga erishasiz!"
                    )
                    
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="🔙 Asosiy menyu", callback_data="menu_back")]
                    ])
                    
                    try:
                        await message.answer(motivational_message, reply_markup=keyboard, parse_mode="HTML")
                    except Exception as e:
                        logger.error(f"Error sending motivational message: {e}", exc_info=True)
                
                # Old CV upload request (keep for backward compatibility, but now we send it above)
                # This is now redundant but kept for safety
                if is_passed and requires_cv and not is_trial:
                    # Already sent above, skip
                    pass
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

