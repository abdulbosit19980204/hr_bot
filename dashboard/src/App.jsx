import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import ToastContainer from './components/ToastContainer'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])

  const showToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type, duration }])
  }

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  // Make showToast available globally
  useEffect(() => {
    window.showToast = showToast
    return () => {
      delete window.showToast
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = () => {
    const token = localStorage.getItem('access_token')
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setIsAuthenticated(true)
    }
    setLoading(false)
  }

  const handleLogin = (token) => {
    localStorage.setItem('access_token', token)
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    delete axios.defaults.headers.common['Authorization']
    setIsAuthenticated(false)
  }

  if (loading) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  if (!isAuthenticated) {
    return (
      <>
        <Login onLogin={handleLogin} apiBaseUrl={API_BASE_URL} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
    )
  }

  return (
    <>
      <Dashboard onLogout={handleLogout} apiBaseUrl={API_BASE_URL} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  )
}

export default App

