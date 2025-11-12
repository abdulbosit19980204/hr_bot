import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './TestPage.css'

function TestPage({ test, user, onComplete, apiBaseUrl, isTrial = false }) {
  const STORAGE_KEY = `test_state_${test.id}_${user?.telegram_id || 'anonymous'}`
  
  // Load state from localStorage (defined before useState to use in initializer)
  const loadState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const state = JSON.parse(saved)
        // Check if state is for current test and not expired (older than 24 hours)
        if (state.testId === test.id && state.telegramId === (user?.telegram_id || 'anonymous')) {
          const stateAge = Date.now() - state.timestamp
          const maxAge = 24 * 60 * 60 * 1000 // 24 hours
          if (stateAge < maxAge) {
            return state
          } else {
            // State expired, remove it
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      }
    } catch (error) {
      console.error('Error loading state:', error)
    }
    return null
  }

  // Try to restore startTime from saved state
  const initialSavedState = loadState()
  const initialStartTime = initialSavedState?.startTime || Date.now()
  const initialTimeLeft = initialSavedState ? (() => {
    const elapsed = Math.floor((Date.now() - initialSavedState.startTime) / 1000)
    const totalTime = test.time_limit * 60
    return Math.max(0, totalTime - elapsed)
  })() : test.time_limit * 60
  
  const [questions, setQuestions] = useState(initialSavedState?.questions || [])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialSavedState?.currentQuestionIndex || 0)
  const [answers, setAnswers] = useState(initialSavedState?.answers || {})
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft)
  const [loading, setLoading] = useState(!initialSavedState) // If we have saved state, don't show loading
  const [submitting, setSubmitting] = useState(false)
  const [startTime, setStartTime] = useState(initialStartTime)
  const [leaveAttempts, setLeaveAttempts] = useState(0)
  const [isBlocked, setIsBlocked] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const testContainerRef = useRef(null)

  // Save state to localStorage
  const saveState = (stateUpdates = {}) => {
    try {
      const currentState = {
        testId: test.id,
        telegramId: user?.telegram_id || 'anonymous',
        questions: questions,
        currentQuestionIndex: currentQuestionIndex,
        answers: answers,
        startTime: startTime,
        isTrial: isTrial,
        timestamp: Date.now(),
        ...stateUpdates
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState))
    } catch (error) {
      console.error('Error saving state:', error)
    }
  }

  // Clear state from localStorage
  const clearState = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing state:', error)
    }
  }

  useEffect(() => {
    // If we don't have saved state, load questions from API
    if (!initialSavedState || !initialSavedState.questions || initialSavedState.questions.length === 0) {
      loadQuestions()
    }
    setupCheatingProtection()
    return () => {
      cleanupCheatingProtection()
    }
  }, [])

  // Save state whenever it changes
  useEffect(() => {
    if (questions.length > 0 && !submitting) {
      saveState({
        questions: questions,
        currentQuestionIndex: currentQuestionIndex,
        answers: answers
      })
    }
  }, [questions, currentQuestionIndex, answers, submitting])

  useEffect(() => {
    if (timeLeft > 0 && !submitting && !loading) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1
          // Save updated time to state
          if (newTime > 0) {
            saveState()
          }
          return newTime
        })
      }, 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !submitting && !loading) {
      handleSubmit()
    }
  }, [timeLeft, submitting, loading])

  // Cheating protection: Disable copy, paste, select, context menu
  const setupCheatingProtection = () => {
    // Disable text selection
    document.addEventListener('selectstart', preventSelection)
    document.addEventListener('copy', preventCopy)
    document.addEventListener('paste', preventPaste)
    document.addEventListener('cut', preventCut)
    document.addEventListener('contextmenu', preventContextMenu)
    document.addEventListener('keydown', handleKeyDown)
    
    // Prevent page leave - only beforeunload (real page leave)
    window.addEventListener('beforeunload', handleBeforeUnload)
    
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

  const handleBeforeUnload = (e) => {
    if (!submitting && !isBlocked) {
      e.preventDefault()
      e.returnValue = 'Siz testni tark etmoqchisiz. Agar testni tark etsangiz, siz block qilinasiz va vakansiyangiz ko\'rib chiqishdan to\'xtatiladi. Davom etasizmi?'
      
      const newAttempts = leaveAttempts + 1
      setLeaveAttempts(newAttempts)
      
      // Notify backend about page leave attempt
      // Use fetch with keepalive to ensure request completes even if page closes
      fetch(`${apiBaseUrl}/tests/${test.id}/notify_page_leave/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: user.telegram_id,
          attempts: newAttempts,
          test_id: test.id
        }),
        keepalive: true
      }).catch(() => {}) // Ignore errors - page might be closing
      
      // If 2+ attempts, block user immediately
      if (newAttempts >= 2) {
        setIsBlocked(true)
        // Block user before page closes
        fetch(`${apiBaseUrl}/tests/${test.id}/block_user/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: user.telegram_id,
            reason: 'Test tark etildi (cheating) - 2+ marta urinish'
          }),
          keepalive: true
        }).catch(() => {}) // Ignore errors - page might be closing
        
        return e.returnValue
      }
      
      return e.returnValue
    }
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
      setLoading(true)
      const params = new URLSearchParams()
      if (user && user.telegram_id) {
        params.append('telegram_id', user.telegram_id)
      }
      if (isTrial) {
        params.append('trial', 'true')
      }
      
      const apiUrl = `${apiBaseUrl}/tests/${test.id}/questions/?${params.toString()}`
      console.log('🔍 Loading questions from:', apiUrl)
      console.log('📝 Test ID:', test.id)
      console.log('👤 User:', user)
      console.log('🧪 Is Trial:', isTrial)
      
      const response = await axios.get(apiUrl)
      console.log('✅ API Response:', response)
      
      const loadedQuestions = response.data
      console.log('📊 Loaded questions:', loadedQuestions)
      
      if (!loadedQuestions || !Array.isArray(loadedQuestions) || loadedQuestions.length === 0) {
        console.error('❌ Questions are empty or invalid:', loadedQuestions)
        setErrorMessage('Savollar topilmadi. Testda savollar mavjud emas yoki sizda testni yechish huquqi yo\'q.')
        setQuestions([])
        setLoading(false)
        return
      }
      
      setQuestions(loadedQuestions)
      
      // Save questions to state immediately
      saveState({ questions: loadedQuestions })
      
      setLoading(false)
    } catch (error) {
      console.error('❌ Error loading questions:', error)
      console.error('📋 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url
      })
      
      if (error.response?.status === 403) {
        clearState() // Clear state if blocked
        alert('Siz block qilingansiz: ' + (error.response?.data?.reason || 'Noma\'lum sabab'))
        if (window.Telegram && window.Telegram.WebApp) {
          window.Telegram.WebApp.close()
        }
      } else if (error.response?.status === 400) {
        // Attempts limit or other validation error
        const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Xatolik yuz berdi'
        setErrorMessage(errorMsg)
        alert(errorMsg)
      } else if (error.response?.status === 404) {
        const errorMsg = 'Test topilmadi yoki faol emas'
        setErrorMessage(errorMsg)
        alert(errorMsg)
      } else {
        const errorMsg = 'Savollar yuklashda xatolik: ' + (error.response?.data?.error || error.message || 'Noma\'lum xatolik')
        setErrorMessage(errorMsg)
        alert(errorMsg)
      }
      
      setQuestions([])
      setLoading(false)
    }
  }

  const handleAnswerSelect = (questionId, optionId) => {
    const newAnswers = {
      ...answers,
      [questionId]: optionId
    }
    setAnswers(newAnswers)
    // Save state immediately when answer is selected
    saveState({ answers: newAnswers })
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const newIndex = currentQuestionIndex + 1
      setCurrentQuestionIndex(newIndex)
      // Save state immediately when navigating
      saveState({ currentQuestionIndex: newIndex })
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      const newIndex = currentQuestionIndex - 1
      setCurrentQuestionIndex(newIndex)
      // Save state immediately when navigating
      saveState({ currentQuestionIndex: newIndex })
    }
  }

  const handleSubmit = async () => {
    if (submitting) return

    setSubmitting(true)
    cleanupCheatingProtection() // Allow normal behavior after submission
    
    // Clear saved state after submission
    clearState()
    
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

      // Clear state after successful submission
      clearState()
      onComplete(response.data)
    } catch (error) {
      console.error('Error submitting test:', error)
      if (error.response?.status === 403) {
        clearState() // Clear state even on error
        alert('Siz block qilingansiz: ' + (error.response?.data?.reason || 'Noma\'lum sabab'))
      } else {
        alert('Testni yuborishda xatolik yuz berdi')
        setSubmitting(false) // Allow retry if not blocked
      }
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

  if (questions.length === 0 && !loading) {
    return (
      <div className="error" style={{ padding: '20px', textAlign: 'center' }}>
        <h3>Savollar topilmadi</h3>
        {errorMessage && <p>{errorMessage}</p>}
        <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          Iltimos, quyidagilarni tekshiring:
        </p>
        <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '10px' }}>
          <li>Test ID: {test?.id || 'Topilmadi'}</li>
          <li>User ID: {user?.telegram_id || 'Topilmadi'}</li>
          <li>Is Trial: {isTrial ? 'Ha' : 'Yo\'q'}</li>
          <li>API URL: {apiBaseUrl || 'Topilmadi'}</li>
        </ul>
        <p style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
          Browser console'da batafsil ma'lumotni ko'rishingiz mumkin.
        </p>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const selectedAnswer = answers[currentQuestion.id]

  return (
    <div ref={testContainerRef} className="test-container" style={{ userSelect: 'none' }}>
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
