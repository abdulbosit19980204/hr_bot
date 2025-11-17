import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import ToastContainer from './components/ToastContainer'
import './App.css'

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }

  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location

    // Ngrok or custom domains (no dev port) should use same host
    if (hostname && hostname.includes('ngrok')) {
      return `${protocol}//${hostname}${port ? `:${port}` : ''}/api`
    }

    // If running from LAN (e.g., 192.168.x.x:3000) use same host but backend port 8000
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const backendPort = port === '3000' || port === '5173' || !port ? '8000' : port
      return `${protocol}//${hostname}:${backendPort}/api`
    }

    // Default localhost dev
    return 'http://localhost:8000/api'
  }

  return 'http://localhost:8000/api'
}

const API_BASE_URL = getApiBaseUrl()
axios.defaults.baseURL = API_BASE_URL

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

