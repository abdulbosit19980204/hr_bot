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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Foydalanuvchilar</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                <th>ID</th>
                <th>Ism</th>
                <th>Familiya</th>
                <th>Telefon</th>
                <th>Email</th>
                <th>Lavozim</th>
                <th>Telegram ID</th>
                <th>Holat</th>
                <th>Ro'yxatdan o'tgan</th>
                <th>Harakatlar</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.first_name || '-'}</td>
                  <td>{user.last_name || '-'}</td>
                  <td>{user.phone || '-'}</td>
                  <td>{user.email || '-'}</td>
                  <td>{user.position?.name || '-'}</td>
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
    </div>
  )
}

export default UsersList

