import React, { useState, useEffect } from 'react'
// Telegram WebApp SDK - using window.Telegram.WebApp directly
import axios from 'axios'
import TestPage from './components/TestPage'
import ResultPage from './components/ResultPage'
import CVUploadPage from './components/CVUploadPage'
import Loading from './components/Loading'
import Error from './components/Error'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [test, setTest] = useState(null)
  const [page, setPage] = useState('test') // test, result, cv
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      // Get test_id and user_id from URL params
      const urlParams = new URLSearchParams(window.location.search)
      const testId = urlParams.get('test_id')
      let userId = urlParams.get('user_id')

      // Try to get user_id from Telegram WebApp
      if (!userId && window.Telegram && window.Telegram.WebApp) {
        try {
          const user = window.Telegram.WebApp.initDataUnsafe?.user
          if (user && user.id) {
            userId = user.id.toString()
          }
        } catch (e) {
          console.error('Error getting Telegram user:', e)
        }
      }

      if (!testId) {
        setError('Test ID topilmadi')
        setLoading(false)
        return
      }

      if (!userId) {
        setError('User ID topilmadi')
        setLoading(false)
        return
      }

      // Get or create user
      const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user || {}
      const userResponse = await axios.post(`${API_BASE_URL}/users/telegram_auth/`, {
        telegram_id: parseInt(userId),
        first_name: telegramUser.first_name || '',
        last_name: telegramUser.last_name || ''
      })

      if (userResponse.data.user) {
        setUser(userResponse.data.user)
        
        // Set auth token
        if (userResponse.data.access) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${userResponse.data.access}`
        }

        // Get test
        const testResponse = await axios.get(`${API_BASE_URL}/tests/${testId}/`)
        if (testResponse.data) {
          setTest(testResponse.data)
        } else {
          setError('Test topilmadi')
        }
      } else {
        setError('Foydalanuvchi topilmadi')
      }
    } catch (err) {
      console.error('Initialization error:', err)
      setError(err.response?.data?.error || err.message || 'Xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  const handleTestComplete = (result) => {
    setTestResult(result)
    setPage('result')
  }

  const handleContinueToCV = () => {
    setPage('cv')
  }

  if (loading) {
    return <Loading />
  }

  if (error) {
    return <Error message={error} />
  }

  if (!test) {
    return <Error message="Test topilmadi" />
  }

  return (
    <div className="container">
      {page === 'test' && (
        <TestPage
          test={test}
          user={user}
          onComplete={handleTestComplete}
          apiBaseUrl={API_BASE_URL}
        />
      )}
      {page === 'result' && (
        <ResultPage
          result={testResult}
          test={test}
          onContinue={handleContinueToCV}
        />
      )}
      {page === 'cv' && (
        <CVUploadPage
          user={user}
          apiBaseUrl={API_BASE_URL}
        />
      )}
    </div>
  )
}

export default App
