import React, { useState, useEffect } from 'react'
import axios from 'axios'

function TestPage({ test, user, onComplete, apiBaseUrl }) {
  const [questions, setQuestions] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(test.time_limit * 60) // Convert to seconds
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [startTime] = useState(Date.now())

  useEffect(() => {
    loadQuestions()
  }, [])

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      handleSubmit()
    }
  }, [timeLeft])

  const loadQuestions = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/tests/${test.id}/questions/`)
      setQuestions(response.data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading questions:', error)
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
        time_taken: timeTaken
      })

      onComplete(response.data)
    } catch (error) {
      console.error('Error submitting test:', error)
      alert('Testni yuborishda xatolik yuz berdi')
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
    <div>
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

      <div className="card question-card">
        <div className="question-text">
          {currentQuestion.text}
        </div>

        <div>
          {currentQuestion.options?.map((option) => (
            <div
              key={option.id}
              className={`option ${selectedAnswer === option.id ? 'selected' : ''}`}
              onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
            >
              <div className="option-label">{option.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          className="btn btn-secondary"
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          ← Oldingi
        </button>
        
        {currentQuestionIndex === questions.length - 1 ? (
          <button
            className="btn"
            onClick={handleSubmit}
            disabled={submitting || !selectedAnswer}
          >
            {submitting ? 'Yuborilmoqda...' : '✅ Testni yakunlash'}
          </button>
        ) : (
          <button
            className="btn"
            onClick={handleNext}
            disabled={!selectedAnswer}
          >
            Keyingi →
          </button>
        )}
      </div>
    </div>
  )
}

export default TestPage

