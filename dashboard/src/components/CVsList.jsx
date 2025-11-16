import React, { useState, useEffect } from 'react'
import axios from 'axios'
import CVDetail from './CVDetail'
import './Dashboard.css'

function CVsList({ apiBaseUrl }) {
  const [cvs, setCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedCV, setSelectedCV] = useState(null)

  useEffect(() => {
    loadUsers()
    loadCVs()
  }, [page, searchTerm, selectedUser])

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await axios.get(`${apiBaseUrl}/users/`, { 
        params: { page_size: 100 },
        headers 
      })
      setUsers(response.data.results || response.data)
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  const loadCVs = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('access_token')
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const params = {
        page,
        user: selectedUser || undefined
      }
      
      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/cvs/`, {
        params,
        headers
      })
      
      let cvList = response.data.results || response.data
      
      // Client-side search (foydalanuvchi ismi bo'yicha)
      if (searchTerm) {
        cvList = cvList.filter(cv => {
          const userName = `${cv.user?.first_name || ''} ${cv.user?.last_name || ''}`.toLowerCase()
          const userEmail = (cv.user?.email || '').toLowerCase()
          const userPhone = (cv.user?.phone || '').toLowerCase()
          const fileName = (cv.file_name || '').toLowerCase()
          const search = searchTerm.toLowerCase()
          return userName.includes(search) || userEmail.includes(search) || userPhone.includes(search) || fileName.includes(search)
        })
      }
      
      setCvs(cvList)
      if (response.data.count) {
        setTotalPages(Math.ceil(response.data.count / 20))
      }
      setLoading(false)
    } catch (err) {
      console.error('Error loading CVs:', err)
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
    loadCVs()
  }

  const handleCVClick = (cv) => {
    setSelectedCV(cv)
  }

  const handleBackToList = () => {
    setSelectedCV(null)
  }

  if (selectedCV) {
    return (
      <CVDetail 
        cv={selectedCV} 
        apiBaseUrl={apiBaseUrl}
        onBack={handleBackToList}
      />
    )
  }

  if (loading && cvs.length === 0) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  return (
    <div className="table-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>CV'lar</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              className="input"
              placeholder="Foydalanuvchi yoki fayl nomi qidirish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '250px', margin: 0 }}
            />
            <select
              className="input"
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value)
                setPage(1)
              }}
              style={{ width: '200px', margin: 0 }}
            >
              <option value="">Barcha foydalanuvchilar</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} {user.phone ? `(${user.phone})` : ''}
                </option>
              ))}
            </select>
            <button type="submit" className="btn" style={{ margin: 0 }}>Qidirish</button>
            {(searchTerm || selectedUser) && (
              <button 
                type="button"
                className="btn" 
                onClick={() => {
                  setSearchTerm('')
                  setSelectedUser('')
                  setPage(1)
                }}
                style={{ margin: 0, background: '#6c757d' }}
              >
                Tozalash
              </button>
            )}
          </form>
        </div>
      </div>

      {cvs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          CV'lar topilmadi
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Foydalanuvchi</th>
                <th>Telefon</th>
                <th>Email</th>
                <th>Fayl nomi</th>
                <th>Fayl hajmi</th>
                <th>Yuklangan</th>
                <th>Harakatlar</th>
              </tr>
            </thead>
            <tbody>
              {cvs.map((cv) => (
                <tr key={cv.id}>
                  <td>{cv.id}</td>
                  <td>{cv.user?.first_name} {cv.user?.last_name}</td>
                  <td>{cv.user?.phone || '-'}</td>
                  <td>{cv.user?.email || '-'}</td>
                  <td>{cv.file_name || (cv.file ? cv.file.split('/').pop() : '-')}</td>
                  <td>{cv.file_size ? `${(cv.file_size / 1024).toFixed(2)} KB` : '-'}</td>
                  <td>{cv.uploaded_at ? new Date(cv.uploaded_at).toLocaleDateString('uz-UZ') : '-'}</td>
                  <td>
                    <button 
                      className="btn" 
                      onClick={() => handleCVClick(cv)}
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

export default CVsList

