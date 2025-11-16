import React, { useState, useEffect } from 'react'
import axios from 'axios'
import UserDetail from './UserDetail'
import './Dashboard.css'

function UsersList({ apiBaseUrl }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPosition, setSelectedPosition] = useState('')
  const [positions, setPositions] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedUsers, setSelectedUsers] = useState(new Set())
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationType, setNotificationType] = useState('interview')
  const [sendingNotification, setSendingNotification] = useState(false)

  useEffect(() => {
    loadPositions()
    loadUsers()
  }, [page, searchTerm, selectedPosition])

  const loadPositions = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await axios.get(`${apiBaseUrl}/positions/`, { headers })
      setPositions(response.data.results || response.data)
    } catch (err) {
      console.error('Error loading positions:', err)
    }
  }

  const loadUsers = async () => {
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
        position: selectedPosition || undefined
      }
      
      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/users/`, {
        params,
        headers
      })
      
      setUsers(response.data.results || response.data)
      if (response.data.count) {
        setTotalPages(Math.ceil(response.data.count / 20))
      }
      setLoading(false)
    } catch (err) {
      console.error('Error loading users:', err)
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
    loadUsers()
  }

  const handleUserClick = (user) => {
    setSelectedUser(user)
  }

  const handleBackToList = () => {
    setSelectedUser(null)
  }

  const handleSelectUser = (userId) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)))
    }
  }

  const handleNotificationTypeChange = (newType) => {
    setNotificationType(newType)
    
    // Auto-fill default templates based on notification type
    if (newType === 'encouragement') {
      if (!notificationTitle) {
        setNotificationTitle('Tashakkur va rag\'batlantirish')
      }
      if (!notificationMessage) {
        setNotificationMessage(
          'Hurmatli nomzod!\n\n' +
          'Sizning test natijangizni ko\'rib chiqdik. Bu safar natija bizning talablarimizga to\'liq javob bermadi, lekin sizning qiziqishingiz va harakatlaringizni qadrlaymiz.\n\n' +
          'Biz sizni keyingi vakansiyalarda ham ko\'rishdan xursand bo\'lamiz. Yangi imkoniyatlar paydo bo\'lganda sizga xabar beramiz.\n\n' +
          'Yana bir bor tashakkur!\n\n' +
          'Hurmat bilan,\n' +
          'HR jamoasi'
        )
      }
    } else if (newType === 'interview') {
      if (!notificationTitle) {
        setNotificationTitle('Suxbat taklifi')
      }
    } else if (newType === 'job_offer') {
      if (!notificationTitle) {
        setNotificationTitle('Ishga taklif')
      }
    }
  }

  const handleSendNotification = async () => {
    if (selectedUsers.size === 0) {
      alert('Iltimos, kamida bitta foydalanuvchini tanlang')
      return
    }

    if (!notificationTitle || !notificationMessage) {
      alert('Iltimos, sarlavha va xabar matnini kiriting')
      return
    }

    try {
      setSendingNotification(true)
      const token = localStorage.getItem('access_token')
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      const userIds = Array.from(selectedUsers)

      const response = await axios.post(
        `${apiBaseUrl}/notifications/send/`,
        {
          user_ids: userIds,
          title: notificationTitle,
          message: notificationMessage,
          notification_type: notificationType
        },
        { headers }
      )

      if (response.data.success) {
        alert(
          `✅ Xabar muvaffaqiyatli yuborildi!\n` +
          `📊 Jami: ${response.data.total}\n` +
          `✅ Muvaffaqiyatli: ${response.data.successful}\n` +
          `❌ Xatolik: ${response.data.failed}`
        )
        setShowNotificationModal(false)
        setSelectedUsers(new Set())
        setNotificationTitle('')
        setNotificationMessage('')
        setNotificationType('interview')
      }
    } catch (err) {
      console.error('Error sending notification:', err)
      alert(
        `❌ Xatolik: ${err.response?.data?.error || err.message || 'Xabar yuborishda xatolik yuz berdi'}`
      )
    } finally {
      setSendingNotification(false)
    }
  }

  if (selectedUser) {
    return (
      <UserDetail 
        user={selectedUser} 
        apiBaseUrl={apiBaseUrl}
        onBack={handleBackToList}
      />
    )
  }

  if (loading && users.length === 0) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  return (
    <div className="table-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Foydalanuvchilar</h3>
          {selectedUsers.size > 0 && (
            <span style={{ 
              background: '#229ED9', 
              color: 'white', 
              padding: '4px 12px', 
              borderRadius: '12px',
              fontSize: '14px'
            }}>
              {selectedUsers.size} ta tanlangan
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedUsers.size > 0 && (
            <button
              className="btn"
              onClick={() => setShowNotificationModal(true)}
              style={{ margin: 0, background: '#28a745' }}
            >
              📨 Notification yuborish ({selectedUsers.size})
            </button>
          )}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              className="input"
              placeholder="Ism, telefon, email qidirish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '250px', margin: 0 }}
            />
            <select
              className="input"
              value={selectedPosition}
              onChange={(e) => {
                setSelectedPosition(e.target.value)
                setPage(1)
              }}
              style={{ width: '200px', margin: 0 }}
            >
              <option value="">Barcha lavozimlar</option>
              {positions.map(pos => (
                <option key={pos.id} value={pos.id}>{pos.name}</option>
              ))}
            </select>
            <button type="submit" className="btn" style={{ margin: 0 }}>Qidirish</button>
          </form>
        </div>
      </div>

      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Foydalanuvchilar topilmadi
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === users.length && users.length > 0}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>ID</th>
                <th>Ism</th>
                <th>Familiya</th>
                <th>Telefon</th>
                <th>Email</th>
                <th>Lavozim</th>
                <th>Test natijalari</th>
                <th>Telegram ID</th>
                <th>Holat</th>
                <th>Ro'yxatdan o'tgan</th>
                <th>Harakatlar</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ background: selectedUsers.has(user.id) ? '#e7f3ff' : '' }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td>{user.id}</td>
                  <td>{user.first_name || '-'}</td>
                  <td>{user.last_name || '-'}</td>
                  <td>{user.phone || '-'}</td>
                  <td>{user.email || '-'}</td>
                  <td>{user.position?.name || '-'}</td>
                  <td>
                    {user.tests_total_count > 0 ? (
                      <div style={{ fontSize: '13px' }}>
                        <div>
                          <strong style={{ color: '#28a745' }}>
                            ✅ {user.tests_passed_count || 0}
                          </strong>
                          {' / '}
                          <span>{user.tests_total_count || 0}</span>
                        </div>
                        {user.best_score !== null && (
                          <div style={{ color: '#666', marginTop: '2px' }}>
                            Eng yaxshi: <strong>{user.best_score}%</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                  <td>{user.telegram_id || '-'}</td>
                  <td>
                    {user.is_blocked ? (
                      <span style={{ color: '#dc3545' }}>🚫 Bloklangan</span>
                    ) : (
                      <span style={{ color: '#28a745' }}>✅ Faol</span>
                    )}
                  </td>
                  <td>{user.created_at ? new Date(user.created_at).toLocaleDateString('uz-UZ') : '-'}</td>
                  <td>
                    <button 
                      className="btn" 
                      onClick={() => handleUserClick(user)}
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

      {/* Notification Modal */}
      {showNotificationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0 }}>Notification yuborish</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              {selectedUsers.size} ta foydalanuvchiga xabar yuboriladi
            </p>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Notification turi:
              </label>
              <select
                className="input"
                value={notificationType}
                onChange={(e) => handleNotificationTypeChange(e.target.value)}
                style={{ width: '100%', margin: 0 }}
              >
                <option value="interview">Suxbat taklifi</option>
                <option value="job_offer">Ishga taklif</option>
                <option value="encouragement">Tashakkur va rag'batlantirish</option>
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Sarlavha:
              </label>
              <input
                type="text"
                className="input"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                placeholder={
                  notificationType === 'interview' ? 'Suxbat taklifi' : 
                  notificationType === 'job_offer' ? 'Ishga taklif' : 
                  'Tashakkur va rag\'batlantirish'
                }
                style={{ width: '100%', margin: 0 }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Xabar matni:
              </label>
              <textarea
                className="input"
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder="Xabar matnini kiriting..."
                rows={6}
                style={{ width: '100%', margin: 0, resize: 'vertical' }}
              />
              <small style={{ color: '#666' }}>
                HTML formatida yozish mumkin: &lt;b&gt;qalin&lt;/b&gt;, &lt;i&gt;kursiv&lt;/i&gt;, &lt;br&gt; yangi qator
              </small>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => {
                  setShowNotificationModal(false)
                  setNotificationTitle('')
                  setNotificationMessage('')
                }}
                style={{ background: '#6c757d' }}
                disabled={sendingNotification}
              >
                Bekor qilish
              </button>
              <button
                className="btn"
                onClick={handleSendNotification}
                disabled={sendingNotification || !notificationTitle || !notificationMessage}
                style={{ background: '#28a745' }}
              >
                {sendingNotification ? 'Yuborilmoqda...' : 'Yuborish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsersList

