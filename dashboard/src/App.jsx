import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

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
    return <Login onLogin={handleLogin} apiBaseUrl={API_BASE_URL} />
  }

  return <Dashboard onLogout={handleLogout} apiBaseUrl={API_BASE_URL} />
}

export default App

