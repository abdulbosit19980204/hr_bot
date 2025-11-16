import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Statistics from './Statistics'
import ResultsTable from './ResultsTable'
import UsersList from './UsersList'
import TestsList from './TestsList'
import CVsList from './CVsList'
import './Dashboard.css'

function Dashboard({ onLogout, apiBaseUrl }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('statistics')

  useEffect(() => {
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    try {
      // Statistics endpoint AllowAny permission ga ega, shuning uchun token talab qilmaydi
      const response = await axios.get(`${apiBaseUrl}/statistics/`, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      setStats(response.data)
      setLoading(false)
    } catch (err) {
      console.error('Statistics load error:', err)
      setError(err.response?.data?.error || err.message || 'Xatolik yuz berdi')
      setLoading(false)
    }
  }

  if (loading && !stats) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  if (error && !stats) {
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

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '24px',
        borderBottom: '2px solid #dee2e6'
      }}>
        <button
          className="btn"
          onClick={() => setActiveTab('statistics')}
          style={{
            background: activeTab === 'statistics' ? '#229ED9' : '#f8f9fa',
            color: activeTab === 'statistics' ? 'white' : '#333',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            padding: '12px 24px',
            cursor: 'pointer',
            fontWeight: activeTab === 'statistics' ? '600' : '400'
          }}
        >
          📊 Statistika
        </button>
        <button
          className="btn"
          onClick={() => setActiveTab('results')}
          style={{
            background: activeTab === 'results' ? '#229ED9' : '#f8f9fa',
            color: activeTab === 'results' ? 'white' : '#333',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            padding: '12px 24px',
            cursor: 'pointer',
            fontWeight: activeTab === 'results' ? '600' : '400'
          }}
        >
          📋 Natijalar
        </button>
        <button
          className="btn"
          onClick={() => setActiveTab('users')}
          style={{
            background: activeTab === 'users' ? '#229ED9' : '#f8f9fa',
            color: activeTab === 'users' ? 'white' : '#333',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            padding: '12px 24px',
            cursor: 'pointer',
            fontWeight: activeTab === 'users' ? '600' : '400'
          }}
        >
          👥 Foydalanuvchilar
        </button>
        <button
          className="btn"
          onClick={() => setActiveTab('tests')}
          style={{
            background: activeTab === 'tests' ? '#229ED9' : '#f8f9fa',
            color: activeTab === 'tests' ? 'white' : '#333',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            padding: '12px 24px',
            cursor: 'pointer',
            fontWeight: activeTab === 'tests' ? '600' : '400'
          }}
        >
          📝 Testlar
        </button>
        <button
          className="btn"
          onClick={() => setActiveTab('cvs')}
          style={{
            background: activeTab === 'cvs' ? '#229ED9' : '#f8f9fa',
            color: activeTab === 'cvs' ? 'white' : '#333',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            padding: '12px 24px',
            cursor: 'pointer',
            fontWeight: activeTab === 'cvs' ? '600' : '400'
          }}
        >
          📄 CV'lar
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'statistics' && stats && (
        <Statistics stats={stats} />
      )}
      {activeTab === 'results' && (
        <ResultsTable apiBaseUrl={apiBaseUrl} />
      )}
      {activeTab === 'users' && (
        <UsersList apiBaseUrl={apiBaseUrl} />
      )}
      {activeTab === 'tests' && (
        <TestsList apiBaseUrl={apiBaseUrl} />
      )}
      {activeTab === 'cvs' && (
        <CVsList apiBaseUrl={apiBaseUrl} />
      )}
    </div>
  )
}

export default Dashboard

