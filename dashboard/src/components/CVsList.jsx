import React, { useState, useEffect } from 'react'
import axios from 'axios'
import CVDetail from './CVDetail'
import { Icon } from './Icons'
import Pagination from './Pagination'
import './Dashboard.css'

function CVsList({ apiBaseUrl }) {
  const [cvs, setCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedCV, setSelectedCV] = useState(null)
  const [selectedCVs, setSelectedCVs] = useState([])
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [fullView, setFullView] = useState(false)
  
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    user: true,
    phone: true,
    email: true,
    fileName: true,
    fileSize: true,
    uploadedAt: true
  })

  useEffect(() => {
    loadUsers()
    loadCVs()
  }, [page, pageSize, searchTerm, selectedUser])

  // Handle keyboard events for full-view toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (fullView && (e.key === 'Escape' || (e.key === 'Enter' && e.target === document.activeElement))) {
        setFullView(false)
      }
    }
    if (fullView) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [fullView])

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
        page_size: pageSize,
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
        setTotalCount(response.data.count)
        setTotalPages(Math.ceil(response.data.count / pageSize))
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

  const handleSelectCV = (cvId) => {
    setSelectedCVs(prev => 
      prev.includes(cvId) 
        ? prev.filter(id => id !== cvId)
        : [...prev, cvId]
    )
  }

  const handleSelectAll = () => {
    if (selectedCVs.length === cvs.length) {
      setSelectedCVs([])
    } else {
      setSelectedCVs(cvs.map(cv => cv.id))
    }
  }

  const handleDownloadZip = async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        alert('Yuklab olish uchun tizimga kirish kerak')
        return
      }
      
      if (selectedCVs.length === 0) {
        alert('Yuklab olish uchun kamida bitta CV tanlang')
        return
      }
      
      const response = await axios.post(
        `${apiBaseUrl}/cvs/download_zip/`,
        { cv_ids: selectedCVs },
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          responseType: 'blob'
        }
      )
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const contentDisposition = response.headers['content-disposition']
      let filename = `cvs_${new Date().toISOString().split('T')[0]}.zip`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) filename = filenameMatch[1]
      }
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      alert(`${selectedCVs.length} ta CV muvaffaqiyatli ZIP formatida yuklab olindi!`)
      setSelectedCVs([])
    } catch (err) {
      console.error('Error downloading CVs:', err)
      alert(err.response?.data?.error || 'CV\'larni yuklab olishda xatolik yuz berdi')
    }
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
    <div className={`table-card ${fullView ? 'full-view' : ''}`} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>CV'lar</h3>
          {selectedCVs.length > 0 && (
            <span style={{ 
              background: '#229ED9', 
              color: 'white', 
              padding: '4px 12px', 
              borderRadius: '12px',
              fontSize: '14px'
            }}>
              {selectedCVs.length} ta tanlangan
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn-icon"
            onClick={() => setFullView(!fullView)}
            title={fullView ? "Oddiy ko'rinish" : "To'liq ekran"}
          >
            <Icon name={fullView ? "minimize" : "maximize"} size={18} color="currentColor" />
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowFilters(!showFilters)}
            title={showFilters ? "Filtrlarni yashirish" : "Filtrlarni ko'rsatish"}
          >
            <Icon name="filter" size={18} color="currentColor" />
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            style={{ position: 'relative' }}
            title="Ustunlarni boshqarish"
          >
            <Icon name="settings" size={18} color="currentColor" />
          </button>
          {selectedCVs.length > 0 && (
            <button
              className="btn-icon btn-icon-primary"
              onClick={handleDownloadZip}
              title={`Tanlangan CV'larni ZIP formatida yuklab olish (${selectedCVs.length})`}
            >
              <Icon name="download" size={18} color="currentColor" />
            </button>
          )}
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
            user: 'Foydalanuvchi',
            phone: 'Telefon',
            email: 'Email',
            fileName: 'Fayl nomi',
            fileSize: 'Fayl hajmi',
            uploadedAt: 'Yuklangan'
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

      {cvs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          CV'lar topilmadi
        </div>
      ) : (
        <>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            position="top"
          />
          <div className="table-wrapper" style={{ 
            overflowX: 'auto', 
            overflowY: 'auto',
            maxHeight: fullView ? 'none' : (pageSize === 10 ? '400px' : pageSize === 25 ? '600px' : pageSize === 50 ? '800px' : 'calc(100vh - 400px)'),
            position: 'relative',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            flex: fullView ? 1 : 'none'
          }}>
            <table style={{ width: '100%', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedCVs.length === cvs.length && cvs.length > 0}
                      onChange={handleSelectAll}
                      title="Barchasini tanlash"
                    />
                  </th>
                  {visibleColumns.id && <th>ID</th>}
                  {visibleColumns.user && <th>Foydalanuvchi</th>}
                  {visibleColumns.phone && <th>Telefon</th>}
                  {visibleColumns.email && <th>Email</th>}
                  {visibleColumns.fileName && <th>Fayl nomi</th>}
                  {visibleColumns.fileSize && <th>Fayl hajmi</th>}
                  {visibleColumns.uploadedAt && <th>Yuklangan</th>}
                  <th>Harakatlar</th>
                </tr>
              </thead>
              <tbody>
                {cvs.map((cv) => (
                  <tr key={cv.id} style={{ background: selectedCVs.includes(cv.id) ? 'rgba(34, 158, 217, 0.04)' : '' }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedCVs.includes(cv.id)}
                        onChange={() => handleSelectCV(cv.id)}
                      />
                    </td>
                    {visibleColumns.id && <td>{cv.id}</td>}
                    {visibleColumns.user && <td>{cv.user?.first_name} {cv.user?.last_name}</td>}
                    {visibleColumns.phone && <td>{cv.user?.phone || '-'}</td>}
                    {visibleColumns.email && <td>{cv.user?.email || '-'}</td>}
                    {visibleColumns.fileName && <td>{cv.file_name || (cv.file ? cv.file.split('/').pop() : '-')}</td>}
                    {visibleColumns.fileSize && <td>{cv.file_size ? `${(cv.file_size / 1024).toFixed(2)} KB` : '-'}</td>}
                    {visibleColumns.uploadedAt && <td>{cv.uploaded_at ? new Date(cv.uploaded_at).toLocaleDateString('uz-UZ') : '-'}</td>}
                    <td>
                      <button 
                        className="btn-icon" 
                        onClick={() => handleCVClick(cv)}
                        title="Ko'rish"
                      >
                        <Icon name="eye" size={18} color="currentColor" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default CVsList

