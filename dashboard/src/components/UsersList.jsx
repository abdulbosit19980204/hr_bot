import React, { useState, useEffect } from 'react'
import axios from 'axios'
import UserDetail from './UserDetail'
import { Icon } from './Icons'
import Pagination from './Pagination'
import './Dashboard.css'

function UsersList({ apiBaseUrl }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPosition, setSelectedPosition] = useState('')
  const [positions, setPositions] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedUsers, setSelectedUsers] = useState(new Set())
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationType, setNotificationType] = useState('interview')
  const [sendingNotification, setSendingNotification] = useState(false)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    firstName: true,
    lastName: true,
    phone: true,
    email: true,
    position: true,
    telegramId: true,
    status: true,
    testsPassed: true,
    bestScore: true
  })

  useEffect(() => {
    loadPositions()
    loadUsers()
  }, [page, pageSize, searchTerm, selectedPosition])

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
        page_size: pageSize,
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
        setTotalCount(response.data.count)
        setTotalPages(Math.ceil(response.data.count / pageSize))
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

  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        alert('Export qilish uchun tizimga kirish kerak')
        return
      }
      
      const params = {
        search: searchTerm || undefined,
        position: selectedPosition || undefined
      }
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/users/export_excel/`, {
        params,
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const contentDisposition = response.headers['content-disposition']
      let filename = `users_${new Date().toISOString().split('T')[0]}.xlsx`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) filename = filenameMatch[1]
      }
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      alert('Foydalanuvchilar muvaffaqiyatli Excel formatida export qilindi!')
    } catch (err) {
      console.error('Error exporting users:', err)
      alert(err.response?.data?.error || 'Foydalanuvchilarni export qilishda xatolik yuz berdi')
    }
  }

  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        alert('Export qilish uchun tizimga kirish kerak')
        return
      }
      
      const params = {
        search: searchTerm || undefined,
        position: selectedPosition || undefined
      }
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/users/export_csv/`, {
        params,
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const contentDisposition = response.headers['content-disposition']
      let filename = `users_${new Date().toISOString().split('T')[0]}.csv`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) filename = filenameMatch[1]
      }
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      alert('Foydalanuvchilar muvaffaqiyatli CSV formatida export qilindi!')
    } catch (err) {
      console.error('Error exporting users:', err)
      alert(err.response?.data?.error || 'Foydalanuvchilarni export qilishda xatolik yuz berdi')
    }
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
    <div className="table-card" style={{ position: 'relative' }}>
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
          <button
            className="btn"
            onClick={() => setShowFilters(!showFilters)}
            style={{ margin: 0, background: '#6c757d' }}
            title="Filtrlarni ko'rsatish/yashirish"
          >
            <Icon name="filter" size={16} color="white" /> {showFilters ? 'Filtrlarni yashirish' : 'Filtrlarni ko\'rsatish'}
          </button>
          <button
            className="btn"
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            style={{ margin: 0, background: '#6c757d', position: 'relative' }}
            title="Ustunlarni boshqarish"
          >
            <Icon name="settings" size={16} color="white" /> Ustunlar
          </button>
          {selectedUsers.size > 0 && (
            <button
              className="btn"
              onClick={() => setShowNotificationModal(true)}
              style={{ margin: 0, background: '#28a745' }}
            >
              <Icon name="bell" size={16} color="white" /> Notification ({selectedUsers.size})
            </button>
          )}
          <button
            className="btn"
            onClick={handleExportExcel}
            style={{ margin: 0, background: '#229ED9' }}
            title="Excel formatida export qilish"
          >
            <Icon name="download" size={16} color="white" /> Excel
          </button>
          <button
            className="btn"
            onClick={handleExportCSV}
            style={{ margin: 0, background: '#6c757d' }}
            title="CSV formatida export qilish"
          >
            <Icon name="download" size={16} color="white" /> CSV
          </button>
        </div>
      </div>

      {/* Filters Section - Toggleable */}
      {showFilters && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '16px', 
          background: 'var(--bg-tertiary)', 
          borderRadius: '12px',
          border: '1px solid var(--border)'
        }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
      )}

      {/* Column Settings Dropdown */}
      {showColumnSettings && (
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '10px',
          background: 'white',
          border: '1px solid #E6E6E6',
          borderRadius: '12px',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.10)',
          padding: '16px',
          zIndex: 100,
          minWidth: '200px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ marginBottom: '12px', fontWeight: 600, fontSize: '14px', color: '#1A1A1A' }}>
            Ustunlarni tanlash
          </div>
          {Object.entries({
            id: 'ID',
            firstName: 'Ism',
            lastName: 'Familiya',
            phone: 'Telefon',
            email: 'Email',
            position: 'Lavozim',
            testsPassed: 'Test natijalari',
            telegramId: 'Telegram ID',
            status: 'Holat',
            bestScore: 'Eng yaxshi ball'
          }).map(([key, label]) => (
            <label key={key} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '8px 0',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#1A1A1A'
            }}>
              <input
                type="checkbox"
                checked={visibleColumns[key]}
                onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Foydalanuvchilar topilmadi
        </div>
      ) : (
        <>
          <div style={{ 
            overflowX: 'auto', 
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 400px)',
            position: 'relative',
            border: '1px solid var(--border)',
            borderRadius: '12px'
          }}>
            <table style={{ width: '100%', minWidth: '100%' }}>
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
                  {visibleColumns.id && <th>ID</th>}
                  {visibleColumns.firstName && <th>Ism</th>}
                  {visibleColumns.lastName && <th>Familiya</th>}
                  {visibleColumns.phone && <th>Telefon</th>}
                  {visibleColumns.email && <th>Email</th>}
                  {visibleColumns.position && <th>Lavozim</th>}
                  {visibleColumns.testsPassed && <th>Test natijalari</th>}
                  {visibleColumns.telegramId && <th>Telegram ID</th>}
                  {visibleColumns.status && <th>Holat</th>}
                  {visibleColumns.bestScore && <th>Eng yaxshi ball</th>}
                  <th>Ro'yxatdan o'tgan</th>
                  <th>Harakatlar</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ background: selectedUsers.has(user.id) ? 'rgba(34, 158, 217, 0.04)' : '' }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    {visibleColumns.id && <td>{user.id}</td>}
                    {visibleColumns.firstName && <td>{user.first_name || '-'}</td>}
                    {visibleColumns.lastName && <td>{user.last_name || '-'}</td>}
                    {visibleColumns.phone && <td>{user.phone || '-'}</td>}
                    {visibleColumns.email && <td>{user.email || '-'}</td>}
                    {visibleColumns.position && <td>{user.position?.name || '-'}</td>}
                    {visibleColumns.testsPassed && (
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
                          </div>
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.telegramId && <td>{user.telegram_id || '-'}</td>}
                    {visibleColumns.status && (
                      <td>
                        {user.is_blocked ? (
                          <span style={{ color: '#dc3545' }}>🚫 Bloklangan</span>
                        ) : (
                          <span style={{ color: '#28a745' }}>✅ Faol</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.bestScore && (
                      <td>
                        {user.best_score !== null ? (
                          <strong>{user.best_score}%</strong>
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>
                    )}
                    <td>{user.created_at ? new Date(user.created_at).toLocaleDateString('uz-UZ') : '-'}</td>
                    <td>
                      <button 
                        className="btn" 
                        onClick={() => handleUserClick(user)}
                        style={{ padding: '6px 12px', fontSize: '14px' }}
                      >
                        <Icon name="eye" size={14} color="currentColor" /> Ko'rish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
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

