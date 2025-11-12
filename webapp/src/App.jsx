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
      const isTrial = urlParams.get('trial') === 'true'
      const debugMode = urlParams.get('debug') === 'true'

      // Debug mode: Show all URL parameters and environment info
      if (debugMode) {
        const debugInfo = {
          fullUrl: window.location.href,
          search: window.location.search,
          hash: window.location.hash,
          urlParams: Object.fromEntries(urlParams.entries()),
          testId: testId,
          userId: userId,
          isTrial: isTrial,
          telegramWebApp: !!window.Telegram?.WebApp,
          telegramUser: window.Telegram?.WebApp?.initDataUnsafe?.user || null,
          apiBaseUrl: API_BASE_URL
        }
        console.log('🔍 DEBUG MODE - URL Information:', debugInfo)
        setError(
          `🔍 <b>DEBUG MODE</b><br/><br/>` +
          `📋 <b>Full URL:</b> ${window.location.href}<br/>` +
          `🔗 <b>Search:</b> ${window.location.search}<br/>` +
          `📝 <b>Test ID:</b> ${testId || 'TOPILMADI'}<br/>` +
          `👤 <b>User ID:</b> ${userId || 'TOPILMADI'}<br/>` +
          `🧪 <b>Is Trial:</b> ${isTrial}<br/>` +
          `📱 <b>Telegram WebApp:</b> ${window.Telegram?.WebApp ? 'Mavjud' : 'Mavjud emas'}<br/>` +
          `🌐 <b>API Base URL:</b> ${API_BASE_URL}<br/><br/>` +
          `📊 <b>Barcha URL parametrlari:</b><br/>` +
          Array.from(urlParams.entries()).map(([key, value]) => `${key}: ${value}`).join('<br/>') +
          `<br/><br/>` +
          `📱 <b>Telegram User:</b> ${window.Telegram?.WebApp?.initDataUnsafe?.user ? JSON.stringify(window.Telegram.WebApp.initDataUnsafe.user, null, 2) : 'Mavjud emas'}`
        )
        setLoading(false)
        return
      }

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
        const userData = userResponse.data.user
        
        // Check if user is blocked
        if (userData.is_blocked) {
          setError(`Siz block qilingansiz: ${userData.blocked_reason || "Noma'lum sabab"}`)
          setLoading(false)
          return
        }
        
        setUser(userData)
        
        // Set auth token
        if (userResponse.data.access) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${userResponse.data.access}`
        }

        // Get test
        try {
          const testResponse = await axios.get(`${API_BASE_URL}/tests/${testId}/`)
          if (testResponse.data && testResponse.data.id) {
            setTest(testResponse.data)
          } else {
            setError('Test topilmadi yoki faol emas')
          }
        } catch (testErr) {
          console.error('Error loading test:', testErr)
          if (testErr.response?.status === 404) {
            setError('Test topilmadi yoki faol emas')
          } else {
            setError(testErr.response?.data?.error || 'Test yuklashda xatolik yuz berdi')
          }
        }
      } else {
        setError('Foydalanuvchi topilmadi')
      }
    } catch (err) {
      console.error('Initialization error:', err)
      if (err.response?.status === 403) {
        setError(`Siz block qilingansiz: ${err.response?.data?.reason || "Noma'lum sabab"}`)
      } else {
        setError(err.response?.data?.error || err.message || 'Xatolik yuz berdi')
      }
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
          isTrial={new URLSearchParams(window.location.search).get('trial') === 'true'}
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
