import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './Dashboard.css'

function NotificationsList({ apiBaseUrl }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sendToAllFilter, setSendToAllFilter] = useState('')

  useEffect(() => {
    loadNotifications()
  }, [page, searchTerm, sendToAllFilter])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('access_token')
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const params = {
        page,
        search: searchTerm || undefined,
        send_to_all: sendToAllFilter || undefined
      }
      
      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/notifications/`, {
        params,
        headers
      })
      
      setNotifications(response.data.results || response.data)
      if (response.data.count) {
        setTotalPages(Math.ceil(response.data.count / 20))
      }
      setLoading(false)
    } catch (err) {
      console.error('Error loading notifications:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('access_token')
        window.location.reload()
      }
      setError(err.response?.data?.error || err.message || 'Xatolik yuz berdi')
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    loadNotifications()
  }

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification)
  }

  const handleBackToList = () => {
    setSelectedNotification(null)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('uz-UZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Strip HTML tags for display
  const stripHtml = (html) => {
    if (!html) return ''
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  if (selectedNotification) {
    return (
      <div className="table-card">
        <button 
          className="btn" 
          onClick={handleBackToList}
          style={{ marginBottom: '20px' }}
        >
          ← Orqaga
        </button>
        
        <h3 style={{ marginBottom: '20px' }}>Xabar tafsilotlari</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <strong>Sarlavha:</strong> {selectedNotification.title}
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <strong>Xabar matni:</strong>
          <div style={{ 
            marginTop: '10px', 
            padding: '15px', 
            background: '#f8f9fa', 
            borderRadius: '8px',
            whiteSpace: 'pre-wrap'
          }}>
            {stripHtml(selectedNotification.message)}
          </div>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <strong>Yuborilgan:</strong> {selectedNotification.send_to_all ? 'Barcha foydalanuvchilar' : `${selectedNotification.recipients_count} ta foydalanuvchi`}
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <strong>Yuborilgan vaqt:</strong> {formatDate(selectedNotification.sent_at)}
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <strong>Yaratilgan:</strong> {formatDate(selectedNotification.created_at)}
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <strong>Yaratgan:</strong> {selectedNotification.created_by ? `${selectedNotification.created_by.first_name} ${selectedNotification.created_by.last_name}` : '-'}
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <strong>Statistika:</strong>
          <div style={{ marginTop: '10px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <div>Jami: {selectedNotification.total_recipients || 0}</div>
            <div style={{ color: '#28a745' }}>Muvaffaqiyatli: {selectedNotification.successful_sends || 0}</div>
            <div style={{ color: '#dc3545' }}>Xatolik: {selectedNotification.failed_sends || 0}</div>
          </div>
        </div>
        
        {selectedNotification.errors && selectedNotification.errors.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <strong>Xatoliklar ({selectedNotification.errors.length}):</strong>
            <div style={{ marginTop: '10px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Foydalanuvchi</th>
                    <th>Telegram ID</th>
                    <th>Xatolik turi</th>
                    <th>Xatolik xabari</th>
                    <th>Vaqt</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedNotification.errors.map((error) => (
                    <tr key={error.id}>
                      <td>{error.user ? `${error.user.first_name} ${error.user.last_name}` : '-'}</td>
                      <td>{error.telegram_id || '-'}</td>
                      <td>{error.error_type || '-'}</td>
                      <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>{error.error_message || '-'}</td>
                      <td>{formatDate(error.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading && notifications.length === 0) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  return (
    <div className="table-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>Xabarlar</h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            className="input"
            placeholder="Sarlavha yoki matn qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '250px', margin: 0 }}
          />
          <select
            className="input"
            value={sendToAllFilter}
            onChange={(e) => {
              setSendToAllFilter(e.target.value)
              setPage(1)
            }}
            style={{ width: '200px', margin: 0 }}
          >
            <option value="">Barcha xabarlar</option>
            <option value="true">Barchaga yuborilgan</option>
            <option value="false">Tanlanganlarga</option>
          </select>
          <button type="submit" className="btn" style={{ margin: 0 }}>Qidirish</button>
        </form>
      </div>

      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Xabarlar topilmadi
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Sarlavha</th>
                <th>Qabul qiluvchilar</th>
                <th>Muvaffaqiyatli</th>
                <th>Xatolik</th>
                <th>Yuborilgan vaqt</th>
                <th>Yaratgan</th>
                <th>Harakatlar</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification) => (
                <tr key={notification.id}>
                  <td>{notification.id}</td>
                  <td>{notification.title}</td>
                  <td>
                    {notification.send_to_all ? (
                      <span style={{ color: '#229ED9' }}>Barcha</span>
                    ) : (
                      `${notification.recipients_count || 0} ta`
                    )}
                  </td>
                  <td style={{ color: '#28a745' }}>{notification.successful_sends || 0}</td>
                  <td style={{ color: '#dc3545' }}>
                    {notification.failed_sends || 0}
                    {notification.errors_count > 0 && (
                      <span title="Xatoliklar bor"> ⚠️</span>
                    )}
                  </td>
                  <td>{formatDate(notification.sent_at)}</td>
                  <td>
                    {notification.created_by 
                      ? `${notification.created_by.first_name} ${notification.created_by.last_name}`
                      : '-'
                    }
                  </td>
                  <td>
                    <button 
                      className="btn" 
                      onClick={() => handleNotificationClick(notification)}
                      style={{ padding: '6px 12px', fontSize: '14px' }}
                    >
                      Ko'rish
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {totalPages > 1 && (
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                className="btn"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Oldingi
              </button>
              <span style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                {page} / {totalPages}
              </span>
              <button
                className="btn"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Keyingi
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default NotificationsList

