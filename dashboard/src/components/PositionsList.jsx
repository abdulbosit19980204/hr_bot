import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Icon } from './Icons'
import Pagination from './Pagination'
import './Dashboard.css'

function PositionsList({ apiBaseUrl }) {
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpenFilter, setIsOpenFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isSuperuser, setIsSuperuser] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPosition, setEditingPosition] = useState(null)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_open: true
  })
  
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    name: true,
    description: true,
    status: true,
    testsCount: true,
    createdAt: true
  })

  useEffect(() => {
    loadPositions()
    checkSuperuser()
  }, [page, pageSize, searchTerm, isOpenFilter])

  const checkSuperuser = async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        setIsSuperuser(false)
        return
      }
      
      const headers = {
        'Authorization': `Bearer ${token}`
      }
      
      // Try to create a position to check permission
      try {
        await axios.post(
          `${apiBaseUrl}/positions/`,
          {
            name: '__permission_check__',
            description: '',
            is_open: false
          },
          { headers }
        )
        setIsSuperuser(true)
        // Delete the test position
        // We'll handle this by checking if we can access all positions
      } catch (err) {
        if (err.response?.status === 403) {
          setIsSuperuser(false)
        } else {
          // Other error - might be validation, check by trying to get all positions
          try {
            const response = await axios.get(`${apiBaseUrl}/positions/`, {
              headers,
              params: { page_size: 100 }
            })
            // If we can see closed positions, we're superuser
            const hasClosed = (response.data.results || response.data).some(p => !p.is_open)
            setIsSuperuser(hasClosed)
          } catch {
            setIsSuperuser(false)
          }
        }
      }
    } catch (err) {
      setIsSuperuser(false)
    }
  }

  const loadPositions = async () => {
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
        is_open: isOpenFilter || undefined
      }
      
      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/positions/`, {
        params,
        headers
      })
      
      setPositions(response.data.results || response.data)
      if (response.data.count) {
        setTotalPages(Math.ceil(response.data.count / 20))
      }
      setLoading(false)
    } catch (err) {
      console.error('Error loading positions:', err)
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
    loadPositions()
  }

  const handleCreate = () => {
    setFormData({ name: '', description: '', is_open: true })
    setShowCreateModal(true)
  }

  const handleEdit = (position) => {
    setEditingPosition(position)
    setFormData({
      name: position.name,
      description: position.description || '',
      is_open: position.is_open
    })
    setShowEditModal(true)
  }

  const handleDelete = async (positionId) => {
    if (!window.confirm('Bu lavozimni o\'chirishni tasdiqlaysizmi?')) {
      return
    }
    
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        alert('O\'chirish uchun tizimga kirish kerak')
        return
      }
      
      await axios.delete(`${apiBaseUrl}/positions/${positionId}/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      alert('Lavozim muvaffaqiyatli o\'chirildi!')
      loadPositions()
    } catch (err) {
      console.error('Error deleting position:', err)
      alert(err.response?.data?.error || 'Lavozimni o\'chirishda xatolik yuz berdi')
    }
  }

  const handleSubmitCreate = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        alert('Yaratish uchun tizimga kirish kerak')
        return
      }
      
      await axios.post(
        `${apiBaseUrl}/positions/`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      alert('Lavozim muvaffaqiyatli yaratildi!')
      setShowCreateModal(false)
      setFormData({ name: '', description: '', is_open: true })
      loadPositions()
    } catch (err) {
      console.error('Error creating position:', err)
      alert(err.response?.data?.error || err.response?.data?.name?.[0] || 'Lavozimni yaratishda xatolik yuz berdi')
    }
  }

  const handleSubmitEdit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        alert('Tahrirlash uchun tizimga kirish kerak')
        return
      }
      
      await axios.patch(
        `${apiBaseUrl}/positions/${editingPosition.id}/`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      alert('Lavozim muvaffaqiyatli yangilandi!')
      setShowEditModal(false)
      setEditingPosition(null)
      setFormData({ name: '', description: '', is_open: true })
      loadPositions()
    } catch (err) {
      console.error('Error updating position:', err)
      alert(err.response?.data?.error || err.response?.data?.name?.[0] || 'Lavozimni yangilashda xatolik yuz berdi')
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading && positions.length === 0) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  return (
    <div className="table-card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>Lavozimlar</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
          {isSuperuser && (
            <button
              className="btn-icon btn-icon-primary"
              onClick={handleCreate}
              title="Yangi lavozim qo'shish"
            >
              <Icon name="plus" size={18} color="currentColor" />
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
              placeholder="Nom yoki tavsif qidirish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '250px', margin: 0 }}
            />
            <select
              className="input"
              value={isOpenFilter}
              onChange={(e) => {
                setIsOpenFilter(e.target.value)
                setPage(1)
              }}
              style={{ width: '150px', margin: 0 }}
            >
              <option value="">Barcha</option>
              <option value="true">Ochiq</option>
              <option value="false">Yopiq</option>
            </select>
            <button type="submit" className="btn" style={{ margin: 0 }}>Qidirish</button>
            {(searchTerm || isOpenFilter) && (
              <button 
                type="button"
                className="btn" 
                onClick={() => {
                  setSearchTerm('')
                  setIsOpenFilter('')
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
            name: 'Nomi',
            description: 'Tavsif',
            status: 'Holat',
            testsCount: 'Testlar soni',
            createdAt: 'Yaratilgan'
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

      {positions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Lavozimlar topilmadi
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
                  {visibleColumns.id && <th>ID</th>}
                  {visibleColumns.name && <th>Nomi</th>}
                  {visibleColumns.description && <th>Tavsif</th>}
                  {visibleColumns.status && <th>Holat</th>}
                  {visibleColumns.testsCount && <th>Testlar soni</th>}
                  {visibleColumns.createdAt && <th>Yaratilgan</th>}
                  {isSuperuser && <th>Harakatlar</th>}
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id}>
                    {visibleColumns.id && <td>{position.id}</td>}
                    {visibleColumns.name && <td>{position.name}</td>}
                    {visibleColumns.description && (
                      <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>
                        {position.description || '-'}
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td>
                        {position.is_open ? (
                          <span style={{ color: '#28a745' }}>Ochiq</span>
                        ) : (
                          <span style={{ color: '#dc3545' }}>Yopiq</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.testsCount && <td>{position.tests_count || 0}</td>}
                    {visibleColumns.createdAt && <td>{formatDate(position.created_at)}</td>}
                    {isSuperuser && (
                      <td>
                        <button
                          className="btn-icon"
                          onClick={() => handleEdit(position)}
                          style={{ 
                            marginRight: '5px',
                            background: '#229ED9',
                            color: 'white'
                          }}
                          title="Tahrirlash"
                        >
                          <Icon name="pencil" size={18} color="currentColor" />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDelete(position.id)}
                          style={{ 
                            background: '#dc3545',
                            color: 'white'
                          }}
                          title="O'chirish"
                        >
                          <Icon name="trash" size={18} color="currentColor" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
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

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0 }}>Yangi lavozim qo'shish</h3>
            <form onSubmit={handleSubmitCreate}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Nomi *
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Tavsif
                </label>
                <textarea
                  className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_open}
                    onChange={(e) => setFormData({ ...formData, is_open: e.target.checked })}
                  />
                  <span>Ochiq (faol)</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: '#6c757d' }}
                >
                  Bekor qilish
                </button>
                <button type="submit" className="btn" style={{ background: '#28a745' }}>
                  Yaratish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingPosition && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0 }}>Lavozimni tahrirlash</h3>
            <form onSubmit={handleSubmitEdit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Nomi *
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Tavsif
                </label>
                <textarea
                  className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_open}
                    onChange={(e) => setFormData({ ...formData, is_open: e.target.checked })}
                  />
                  <span>Ochiq (faol)</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingPosition(null)
                  }}
                  style={{ background: '#6c757d' }}
                >
                  Bekor qilish
                </button>
                <button type="submit" className="btn" style={{ background: '#229ED9' }}>
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PositionsList

