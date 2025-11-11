import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './TestPage.css'

function TestPage({ test, user, onComplete, apiBaseUrl, isTrial = false }) {
  const [questions, setQuestions] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(test.time_limit * 60) // Convert to seconds
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [startTime] = useState(Date.now())
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [attemptedLeave, setAttemptedLeave] = useState(false)
  const [leaveAttempts, setLeaveAttempts] = useState(0)
  const [isBlocked, setIsBlocked] = useState(false)
  const testContainerRef = useRef(null)

  useEffect(() => {
    loadQuestions()
    setupCheatingProtection()
    return () => {
      cleanupCheatingProtection()
    }
  }, [])

  useEffect(() => {
    if (timeLeft > 0 && !submitting) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !submitting) {
      handleSubmit()
    }
  }, [timeLeft, submitting])

  // Cheating protection: Disable copy, paste, select, context menu
  const setupCheatingProtection = () => {
    // Disable text selection
    document.addEventListener('selectstart', preventSelection)
    document.addEventListener('copy', preventCopy)
    document.addEventListener('paste', preventPaste)
    document.addEventListener('cut', preventCut)
    document.addEventListener('contextmenu', preventContextMenu)
    document.addEventListener('keydown', handleKeyDown)
    
    // Prevent page leave
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    
    // Disable right click
    document.addEventListener('mousedown', handleMouseDown)
    
    // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    document.addEventListener('keydown', handleDevTools)
    
    // Disable dragging
    document.addEventListener('dragstart', preventDrag)
  }

  const cleanupCheatingProtection = () => {
    document.removeEventListener('selectstart', preventSelection)
    document.removeEventListener('copy', preventCopy)
    document.removeEventListener('paste', preventPaste)
    document.removeEventListener('cut', preventCut)
    document.removeEventListener('contextmenu', preventContextMenu)
    document.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('beforeunload', handleBeforeUnload)
    window.removeEventListener('blur', handleBlur)
    window.removeEventListener('focus', handleFocus)
    document.removeEventListener('mousedown', handleMouseDown)
    document.removeEventListener('keydown', handleDevTools)
    document.removeEventListener('dragstart', preventDrag)
  }

  const preventSelection = (e) => {
    e.preventDefault()
    return false
  }

  const preventCopy = (e) => {
    e.preventDefault()
    return false
  }

  const preventPaste = (e) => {
    e.preventDefault()
    return false
  }

  const preventCut = (e) => {
    e.preventDefault()
    return false
  }

  const preventContextMenu = (e) => {
    e.preventDefault()
    return false
  }

  const preventDrag = (e) => {
    e.preventDefault()
    return false
  }

  const handleKeyDown = (e) => {
    // Allow navigation keys
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
      return
    }
    
    // Prevent F12 and other dev tools shortcuts
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U') ||
        (e.ctrlKey && e.key === 'S') ||
        (e.ctrlKey && e.key === 'P')) {
      e.preventDefault()
      return false
    }
  }

  const handleDevTools = (e) => {
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')) {
      e.preventDefault()
      blockUser('DevTools ochishga urinish (cheating)')
      return false
    }
  }

  const handleMouseDown = (e) => {
    if (e.button === 2) { // Right click
      e.preventDefault()
      return false
    }
  }

  const handleBeforeUnload = async (e) => {
    if (!submitting && !isBlocked) {
      e.preventDefault()
      e.returnValue = 'Siz testni tark etmoqchisiz. Agar testni tark etsangiz, siz block qilinasiz va vakansiyangiz ko\'rib chiqishdan to\'xtatiladi. Davom etasizmi?'
      
      const newAttempts = leaveAttempts + 1
      setLeaveAttempts(newAttempts)
      
      // Notify backend about page leave attempt
      await notifyPageLeaveAttempt(newAttempts)
      
      // If 2+ attempts, block user and stop test
      if (newAttempts >= 2) {
        setIsBlocked(true)
        await blockUserAndStopTest('Test tark etildi (cheating) - 2+ marta urinish')
        return e.returnValue
      }
      
      setShowLeaveModal(true)
      setAttemptedLeave(true)
      return e.returnValue
    }
  }

  const handleBlur = async () => {
    if (!submitting && !isBlocked && !attemptedLeave) {
      const newAttempts = leaveAttempts + 1
      setLeaveAttempts(newAttempts)
      
      // Notify backend about page leave attempt
      await notifyPageLeaveAttempt(newAttempts)
      
      // If 2+ attempts, block user and stop test
      if (newAttempts >= 2) {
        setIsBlocked(true)
        await blockUserAndStopTest('Test tark etildi (cheating) - 2+ marta urinish')
        return
      }
      
      setShowLeaveModal(true)
      setAttemptedLeave(true)
    }
  }

  const handleFocus = () => {
    if (attemptedLeave && !submitting && !isBlocked) {
      setShowLeaveModal(true)
    }
  }
  
  const notifyPageLeaveAttempt = async (attempts) => {
    try {
      await axios.post(`${apiBaseUrl}/tests/${test.id}/notify_page_leave/`, {
        telegram_id: user.telegram_id,
        attempts: attempts,
        test_id: test.id
      })
    } catch (error) {
      console.error('Error notifying page leave attempt:', error)
    }
  }
  
  const blockUserAndStopTest = async (reason) => {
    try {
      // Block user
      await blockUser(reason)
      
      // Stop test - submit with empty answers
      setSubmitting(true)
      cleanupCheatingProtection()
      
      // Notify user
      alert('⚠️ Siz testni tark etganingiz uchun block qilindingiz va test to\'xtatildi!')
      
      // Close WebApp
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.close()
      } else {
        window.close()
      }
    } catch (error) {
      console.error('Error blocking user and stopping test:', error)
    }
  }

  const handleConfirmLeave = async () => {
    setShowLeaveModal(false)
    setIsBlocked(true)
    const newAttempts = leaveAttempts + 1
    
    // Notify backend about page leave attempt
    await notifyPageLeaveAttempt(newAttempts)
    
    // Block user and stop test
    await blockUserAndStopTest('Test tark etildi (cheating) - foydalanuvchi tasdiqladi')
  }

  const handleCancelLeave = () => {
    setShowLeaveModal(false)
    setAttemptedLeave(false)
  }

  const blockUser = async (reason) => {
    try {
      await axios.post(`${apiBaseUrl}/tests/${test.id}/block_user/`, {
        telegram_id: user.telegram_id,
        reason: reason
      })
    } catch (error) {
      console.error('Error blocking user:', error)
    }
  }

  const loadQuestions = async () => {
    try {
      const params = new URLSearchParams()
      if (user && user.telegram_id) {
        params.append('telegram_id', user.telegram_id)
      }
      if (isTrial) {
        params.append('trial', 'true')
      }
      
      const response = await axios.get(
        `${apiBaseUrl}/tests/${test.id}/questions/?${params.toString()}`
      )
      setQuestions(response.data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading questions:', error)
      if (error.response?.status === 403) {
        alert('Siz block qilingansiz: ' + (error.response?.data?.reason || 'Noma\'lum sabab'))
        if (window.Telegram && window.Telegram.WebApp) {
          window.Telegram.WebApp.close()
        }
      }
      setLoading(false)
    }
  }

  const handleAnswerSelect = (questionId, optionId) => {
    setAnswers({
      ...answers,
      [questionId]: optionId
    })
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleSubmit = async () => {
    if (submitting) return

    setSubmitting(true)
    cleanupCheatingProtection() // Allow normal behavior after submission
    
    try {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000)
      
      // Format answers for API
      const answersData = Object.entries(answers).map(([questionId, optionId]) => ({
        question_id: parseInt(questionId),
        option_id: parseInt(optionId)
      }))

      const response = await axios.post(`${apiBaseUrl}/results/`, {
        test_id: test.id,
        answers: answersData,
        time_taken: timeTaken,
        telegram_id: user?.telegram_id,
        is_trial: isTrial
      })

      onComplete(response.data)
    } catch (error) {
      console.error('Error submitting test:', error)
      if (error.response?.status === 403) {
        alert('Siz block qilingansiz: ' + (error.response?.data?.reason || 'Noma\'lum sabab'))
      } else {
        alert('Testni yuborishda xatolik yuz berdi')
      }
      setSubmitting(false)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0

  if (loading) {
    return <div className="loading">Savollar yuklanmoqda...</div>
  }

  if (questions.length === 0) {
    return <div className="error">Savollar topilmadi</div>
  }

  const currentQuestion = questions[currentQuestionIndex]
  const selectedAnswer = answers[currentQuestion.id]

  return (
    <div ref={testContainerRef} className="test-container" style={{ userSelect: 'none' }}>
      {/* Leave Warning Modal */}
      {showLeaveModal && !isBlocked && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>⚠️ Ogohlantirish</h3>
            <p>
              Siz testni tark etmoqchisiz. Agar testni tark etsangiz, siz block qilinasiz va vakansiyangiz ko'rib chiqishdan to'xtatiladi.
            </p>
            {leaveAttempts > 0 && (
              <p style={{ color: leaveAttempts >= 2 ? '#dc3545' : '#ff9800', fontWeight: 'bold', marginTop: '10px' }}>
                ⚠️ Urinishlar soni: {leaveAttempts} / 2
                {leaveAttempts >= 2 && ' - Keyingi urinishda siz avtomatik block qilinasiz!'}
              </p>
            )}
            <p><strong>Haqiqatdan ham testni tark etmoqchimisiz?</strong></p>
            <div className="modal-buttons">
              <button className="btn btn-danger" onClick={handleConfirmLeave}>
                Ha, tark etish
              </button>
              <button className="btn btn-secondary" onClick={handleCancelLeave}>
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Blocked Modal */}
      {isBlocked && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content">
            <h3>❌ Test to'xtatildi</h3>
            <p>
              Siz testni tark etganingiz uchun block qilindingiz va test to'xtatildi.
            </p>
            <p><strong>Sabab: Test tark etildi (cheating)</strong></p>
            <div className="modal-buttons">
              <button className="btn btn-primary" onClick={() => {
                if (window.Telegram && window.Telegram.WebApp) {
                  window.Telegram.WebApp.close()
                } else {
                  window.close()
                }
              }}>
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Info */}
      <div className="card user-info-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>👤 {user?.first_name} {user?.last_name}</strong>
            {user?.position && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                💼 {user.position.name}
              </div>
            )}
          </div>
          {isTrial && (
            <span className="trial-badge">🧪 Trial Test</span>
          )}
        </div>
      </div>

      {/* Test Info */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <strong>{test.title}</strong>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
              Savol {currentQuestionIndex + 1} / {questions.length}
            </div>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: timeLeft < 60 ? '#dc3545' : '#229ED9' }}>
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>
        
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {/* Question Card */}
      <div className="card question-card" style={{ userSelect: 'none' }}>
        <div className="question-text" style={{ userSelect: 'none' }}>
          {currentQuestion.text}
        </div>

        <div>
          {currentQuestion.options?.map((option) => (
            <div
              key={option.id}
              className={`option ${selectedAnswer === option.id ? 'selected' : ''}`}
              onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
              style={{ userSelect: 'none', cursor: 'pointer' }}
            >
              <div className="option-label">{option.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          className="btn btn-secondary"
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0 || submitting}
        >
          ← Oldingi
        </button>
        
        {currentQuestionIndex === questions.length - 1 ? (
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !selectedAnswer}
          >
            {submitting ? 'Yuborilmoqda...' : '✅ Testni yakunlash'}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleNext}
            disabled={!selectedAnswer || submitting}
          >
            Keyingi →
          </button>
        )}
      </div>
    </div>
  )
}

export default TestPage
