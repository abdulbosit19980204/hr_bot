import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Statistics from './Statistics'
import ResultsTable from './ResultsTable'
import './Dashboard.css'

function Dashboard({ onLogout, apiBaseUrl }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/statistics/`)
      setStats(response.data)
      setLoading(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Xatolik yuz berdi')
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  return (
    <div className="container">
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>HR Test Dashboard</h1>
          <button className="btn" onClick={onLogout}>Chiqish</button>
        </div>
      </div>

      {stats && (
        <>
          <Statistics stats={stats} />
          <ResultsTable apiBaseUrl={apiBaseUrl} />
        </>
      )}
    </div>
  )
}

export default Dashboard

