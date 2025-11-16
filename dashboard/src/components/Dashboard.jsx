import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Statistics from './Statistics'
import ResultsTable from './ResultsTable'
import UsersList from './UsersList'
import TestsList from './TestsList'
import CVsList from './CVsList'
import NotificationsList from './NotificationsList'
import PositionsList from './PositionsList'
import ScrollToTop from './ScrollToTop'
import { Icon } from './Icons'
import './Dashboard.css'

function Dashboard({ onLogout, apiBaseUrl }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('statistics')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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

  const menuItems = [
    { id: 'statistics', icon: 'chart-bar', label: 'Statistika' },
    { id: 'results', icon: 'clipboard-list', label: 'Natijalar' },
    { id: 'users', icon: 'users', label: 'Foydalanuvchilar' },
    { id: 'tests', icon: 'clipboard-check', label: 'Testlar' },
    { id: 'cvs', icon: 'file-text', label: 'CV\'lar' },
    { id: 'notifications', icon: 'bell', label: 'Xabarlar' },
    { id: 'positions', icon: 'briefcase', label: 'Lavozimlar' }
  ]

  return (
    <div className="dashboard-wrapper">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="mobile-sidebar-overlay"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          {!sidebarCollapsed && (
            <div className="sidebar-logo">
              <h2>Gloriya HR</h2>
              <span className="sidebar-subtitle">Helper</span>
            </div>
          )}
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Kengaytirish' : 'Qisqartirish'}
          >
            <Icon name={sidebarCollapsed ? 'chevron-right' : 'chevron-left'} size={18} color="currentColor" />
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id)
                setMobileSidebarOpen(false)
              }}
              title={sidebarCollapsed ? item.label : ''}
            >
              <span className="sidebar-icon">
                <Icon name={item.icon} size={20} color={activeTab === item.id ? '#FFFFFF' : 'currentColor'} />
              </span>
              {!sidebarCollapsed && <span className="sidebar-label">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button 
            className="sidebar-item sidebar-logout"
            onClick={onLogout}
            title={sidebarCollapsed ? 'Chiqish' : ''}
          >
            <span className="sidebar-icon">
              <Icon name="log-out" size={20} color="currentColor" />
            </span>
            {!sidebarCollapsed && <span className="sidebar-label">Chiqish</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Top Header */}
        <header className="dashboard-header">
          <button 
            className="mobile-menu-toggle"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          >
            <Icon name="menu" size={20} color="currentColor" />
          </button>
          <h1 className="dashboard-title">
            {menuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
          </h1>
        </header>

        {/* Content Area */}
        <main className="dashboard-content">
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
          {activeTab === 'notifications' && (
            <NotificationsList apiBaseUrl={apiBaseUrl} />
          )}
          {activeTab === 'positions' && (
            <PositionsList apiBaseUrl={apiBaseUrl} />
          )}
        </main>
      </div>
      <ScrollToTop />
    </div>
  )
}

export default Dashboard

