import React, { useState, useEffect } from 'react'
import axios from 'axios'
import TestDetail from './TestDetail'
import { Icon } from './Icons'
import Pagination from './Pagination'
import './Dashboard.css'

function TestsList({ apiBaseUrl }) {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPosition, setSelectedPosition] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [positions, setPositions] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedTest, setSelectedTest] = useState(null)
  const [isSuperuser, setIsSuperuser] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTest, setEditingTest] = useState(null)
  const [importingTest, setImportingTest] = useState(false)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    title: true,
    positions: true,
    questionsCount: true,
    timeLimit: true,
    passingScore: true,
    maxAttempts: true,
    status: true,
    createdAt: true
  })

  useEffect(() => {
    loadPositions()
    loadTests()
    checkSuperuser()
  }, [page, pageSize, searchTerm, selectedPosition, statusFilter])
  
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
      
      // First, get a list of tests to find a valid test ID
      const testsResponse = await axios.get(`${apiBaseUrl}/tests/`, {
        headers,
        params: { page_size: 1 }
      })
      
      const tests = testsResponse.data.results || testsResponse.data
      if (tests.length === 0) {
        // No tests available, try to create one to check permission
        try {
          await axios.post(
            `${apiBaseUrl}/tests/`,
            {
              title: '__permission_check__',
              time_limit: 60,
              passing_score: 60
            },
            { headers }
          )
          setIsSuperuser(true)
        } catch (err) {
          setIsSuperuser(err.response?.status !== 403)
        }
        return
      }
      
      // Try to access questions_list endpoint (superuser only) with first test
      const testId = tests[0].id
      await axios.get(`${apiBaseUrl}/tests/${testId}/questions_list/`, {
        headers,
        params: { page: 1, page_size: 1 }
      })
      setIsSuperuser(true)
    } catch (err) {
      if (err.response?.status === 403) {
        setIsSuperuser(false)
      } else {
        // Other error - assume not superuser
        setIsSuperuser(false)
      }
    }
  }

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

  const loadTests = async () => {
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
        positions: selectedPosition || undefined
      }
      
      // Only add is_active filter if not 'all'
      if (statusFilter === 'active') {
        params.is_active = true
      } else if (statusFilter === 'inactive') {
        params.is_active = false
      }
      // If statusFilter is 'all', don't add is_active param at all
      
      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/tests/`, {
        params,
        headers
      })
      
      setTests(response.data.results || response.data)
      if (response.data.count) {
        setTotalCount(response.data.count)
        setTotalPages(Math.ceil(response.data.count / pageSize))
      }
      setLoading(false)
    } catch (err) {
      console.error('Error loading tests:', err)
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
    loadTests()
  }

  const handleTestClick = (test) => {
    setSelectedTest(test)
  }

  const handleBackToList = () => {
    setSelectedTest(null)
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
        positions: selectedPosition || undefined,
        is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined
      }
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/tests/export_excel/`, {
        params,
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const contentDisposition = response.headers['content-disposition']
      let filename = `tests_${new Date().toISOString().split('T')[0]}.xlsx`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) filename = filenameMatch[1]
      }
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      alert('Testlar muvaffaqiyatli Excel formatida export qilindi!')
    } catch (err) {
      console.error('Error exporting tests:', err)
      alert(err.response?.data?.error || 'Testlarni export qilishda xatolik yuz berdi')
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
        positions: selectedPosition || undefined,
        is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined
      }
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/tests/export_csv/`, {
        params,
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const contentDisposition = response.headers['content-disposition']
      let filename = `tests_${new Date().toISOString().split('T')[0]}.csv`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) filename = filenameMatch[1]
      }
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      alert('Testlar muvaffaqiyatli CSV formatida export qilindi!')
    } catch (err) {
      console.error('Error exporting tests:', err)
      alert(err.response?.data?.error || 'Testlarni export qilishda xatolik yuz berdi')
    }
  }

  const handleDeleteTest = async (testId) => {
    try {
      const token = localStorage.getItem('access_token')
      const headers = {
        'Authorization': `Bearer ${token}`
      }

      await axios.delete(`${apiBaseUrl}/tests/${testId}/`, { headers })
      alert('Test muvaffaqiyatli o\'chirildi!')
      loadTests()
    } catch (err) {
      console.error('Error deleting test:', err)
      alert(err.response?.data?.error || err.response?.data?.detail || 'Test o\'chirishda xatolik yuz berdi')
    }
  }

  const handleImportTest = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Faqat Excel fayllar (.xlsx, .xls) qabul qilinadi!')
      e.target.value = '' // Reset file input
      return
    }
    
    try {
      setImportingTest(true)
      
      // Confirm import
      if (!window.confirm('Excel fayldan to\'liq testni import qilishni tasdiqlaysizmi?')) {
        e.target.value = '' // Reset file input
        setImportingTest(false)
        return
      }
      
      const token = localStorage.getItem('access_token')
      
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('file', file)
      
      // Send to backend
      const response = await axios.post(
        `${apiBaseUrl}/tests/import_test/`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      )
      
      if (response.data.success) {
        const msg = `Test muvaffaqiyatli import qilindi!\nTest: "${response.data.test_title}"\nSavollar: ${response.data.imported_count} ta`
        if (response.data.errors && response.data.errors.length > 0) {
          alert(`${msg}\n\nXatoliklar:\n${response.data.errors.slice(0, 10).join('\n')}${response.data.errors.length > 10 ? `\n... va yana ${response.data.errors.length - 10} ta xatolik` : ''}`)
        } else {
          alert(msg)
        }
        
        // Reload tests list
        loadTests()
      }
      
      e.target.value = '' // Reset file input
    } catch (err) {
      console.error('Error importing test:', err)
      alert(err.response?.data?.error || 'Testni import qilishda xatolik yuz berdi')
    } finally {
      setImportingTest(false)
    }
  }

  if (selectedTest) {
    return (
      <TestDetail 
        test={selectedTest} 
        apiBaseUrl={apiBaseUrl}
        onBack={handleBackToList}
      />
    )
  }

  if (loading && tests.length === 0) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  return (
    <div className="table-card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>Testlar</h3>
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
          <button
            className="btn-icon btn-icon-primary"
            onClick={handleExportExcel}
            title="Excel formatida export qilish"
          >
            <Icon name="download" size={18} color="currentColor" />
          </button>
          <button
            className="btn-icon"
            onClick={handleExportCSV}
            title="CSV formatida export qilish"
          >
            <Icon name="download" size={18} color="currentColor" />
          </button>
          {isSuperuser && (
            <>
              <button
                className="btn-icon btn-icon-primary"
                onClick={() => setShowCreateModal(true)}
                title="Yangi test qo'shish"
              >
                <Icon name="plus" size={18} color="currentColor" />
              </button>
              <label 
                className="btn-icon btn-icon-primary"
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title="Excel fayldan to'liq test import qilish"
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleImportTest}
                  disabled={importingTest}
                />
                {importingTest ? (
                  <Icon name="check" size={18} color="currentColor" />
                ) : (
                  <Icon name="upload" size={18} color="currentColor" />
                )}
              </label>
            </>
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
              placeholder="Test nomi qidirish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '200px', margin: 0 }}
            />
            <select
              className="input"
              value={selectedPosition}
              onChange={(e) => {
                setSelectedPosition(e.target.value)
                setPage(1)
              }}
              style={{ width: '180px', margin: 0 }}
            >
              <option value="">Barcha lavozimlar</option>
              {positions.map(pos => (
                <option key={pos.id} value={pos.id}>{pos.name}</option>
              ))}
            </select>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              style={{ width: '150px', margin: 0 }}
            >
              <option value="all">Barcha testlar</option>
              <option value="active">Faol testlar</option>
              <option value="inactive">Nofaol testlar</option>
            </select>
            <button type="submit" className="btn" style={{ margin: 0 }}>Qidirish</button>
            {(searchTerm || selectedPosition || statusFilter !== 'active') && (
              <button 
                type="button"
                className="btn" 
                onClick={() => {
                  setSearchTerm('')
                  setSelectedPosition('')
                  setStatusFilter('active')
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
            title: 'Test nomi',
            positions: 'Lavozimlar',
            questionsCount: 'Savollar soni',
            timeLimit: 'Vaqt chegarasi',
            passingScore: 'O\'tish balli',
            maxAttempts: 'Max urinishlar',
            status: 'Holat',
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

      {tests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Testlar topilmadi
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
                  {visibleColumns.title && <th>Test nomi</th>}
                  {visibleColumns.positions && <th>Lavozimlar</th>}
                  {visibleColumns.questionsCount && <th>Savollar soni</th>}
                  {visibleColumns.timeLimit && <th>Vaqt chegarasi</th>}
                  {visibleColumns.passingScore && <th>O'tish balli</th>}
                  {visibleColumns.maxAttempts && <th>Max urinishlar</th>}
                  {visibleColumns.status && <th>Holat</th>}
                  {visibleColumns.createdAt && <th>Yaratilgan</th>}
                  <th>Harakatlar</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => (
                  <tr key={test.id}>
                    {visibleColumns.id && <td>{test.id}</td>}
                    {visibleColumns.title && <td>{test.title}</td>}
                    {visibleColumns.positions && (
                      <td>
                        {test.positions && test.positions.length > 0 ? (
                          test.positions.map(pos => pos.name).join(', ')
                        ) : '-'}
                      </td>
                    )}
                    {visibleColumns.questionsCount && <td>{test.questions_count || 0}</td>}
                    {visibleColumns.timeLimit && <td>{test.time_limit} daqiqa</td>}
                    {visibleColumns.passingScore && <td>{test.passing_score}%</td>}
                    {visibleColumns.maxAttempts && <td>{test.max_attempts || '-'}</td>}
                    {visibleColumns.status && (
                      <td>
                        {test.is_active ? (
                          <span style={{ color: '#28a745' }}>✅ Faol</span>
                        ) : (
                          <span style={{ color: '#dc3545' }}>❌ Nofaol</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.createdAt && <td>{test.created_at ? new Date(test.created_at).toLocaleDateString('uz-UZ') : '-'}</td>}
                    <td>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          onClick={() => handleTestClick(test)}
                          className="btn-icon"
                          title="Ko'rish"
                        >
                          <Icon name="eye" size={18} color="currentColor" />
                        </button>
                        {isSuperuser && (
                          <>
                            <button
                              onClick={() => {
                                setEditingTest(test)
                                setShowEditModal(true)
                              }}
                              className="btn-icon"
                              style={{ background: '#ffc107', color: 'white' }}
                              title="Tahrirlash"
                            >
                              <Icon name="pencil" size={18} color="currentColor" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`"${test.title}" testini o'chirishni tasdiqlaysizmi?`)) {
                                  handleDeleteTest(test.id)
                                }
                              }}
                              className="btn-icon"
                              style={{ background: '#dc3545', color: 'white' }}
                              title="O'chirish"
                            >
                              <Icon name="trash" size={18} color="currentColor" />
                            </button>
                          </>
                        )}
                    </div>
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

      {/* Create Test Modal */}
      {showCreateModal && (
        <CreateTestModal
          apiBaseUrl={apiBaseUrl}
          positions={positions}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadTests()
          }}
        />
      )}

      {/* Edit Test Modal */}
      {showEditModal && editingTest && (
        <EditTestModal
          apiBaseUrl={apiBaseUrl}
          test={editingTest}
          positions={positions}
          onClose={() => {
            setShowEditModal(false)
            setEditingTest(null)
          }}
          onSuccess={() => {
            setShowEditModal(false)
            setEditingTest(null)
            loadTests()
          }}
        />
      )}
    </div>
  )
}

// Edit Test Modal Component
function EditTestModal({ apiBaseUrl, test, positions, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: test.title || '',
    description: test.description || '',
    position_ids: test.positions ? test.positions.map(p => p.id) : [],
    time_limit: test.time_limit || 60,
    passing_score: test.passing_score || 60,
    test_mode: test.test_mode || 'both',
    random_questions_count: test.random_questions_count || 0,
    show_answers_immediately: test.show_answers_immediately !== undefined ? test.show_answers_immediately : true,
    trial_questions_count: test.trial_questions_count || 10,
    max_attempts: test.max_attempts || 2,
    max_trial_attempts: test.max_trial_attempts || 1,
    is_active: test.is_active !== undefined ? test.is_active : true
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      setError('Test nomi kiritilishi shart')
      return
    }

    try {
      setSaving(true)
      setError('')
      const token = localStorage.getItem('access_token')
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      const response = await axios.put(
        `${apiBaseUrl}/tests/${test.id}/`,
        {
          ...formData,
          position_ids: formData.position_ids.length > 0 ? formData.position_ids : null
        },
        { headers }
      )

      if (response.data.id) {
        alert('Test muvaffaqiyatli yangilandi!')
        onSuccess()
      }
    } catch (err) {
      console.error('Error updating test:', err)
      setError(err.response?.data?.error || err.response?.data?.detail || 'Test yangilashda xatolik yuz berdi')
    } finally {
      setSaving(false)
    }
  }

  const handlePositionChange = (positionId) => {
    const id = Number(positionId)
    setFormData(prev => ({
      ...prev,
      position_ids: prev.position_ids.includes(id)
        ? prev.position_ids.filter(p => p !== id)
        : [...prev.position_ids, id]
    }))
  }

  return (
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
        maxWidth: '700px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h3 style={{ marginTop: 0 }}>Testni tahrirlash</h3>
        
        {error && (
          <div className="error" style={{ marginBottom: '20px' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Test nomi *:
            </label>
            <input
              type="text"
              className="input"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              style={{ width: '100%', margin: 0 }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Tavsif:
            </label>
            <textarea
              className="input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              style={{ width: '100%', margin: 0, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Lavozimlar:
            </label>
            <div style={{ 
              border: '1px solid #ddd', 
              borderRadius: '6px', 
              padding: '10px', 
              maxHeight: '150px', 
              overflow: 'auto',
              background: '#f9f9f9'
            }}>
              {positions.length === 0 ? (
                <div style={{ color: '#999', fontStyle: 'italic' }}>Lavozimlar topilmadi</div>
              ) : (
                positions.map(pos => (
                  <label key={pos.id} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.position_ids.includes(pos.id)}
                      onChange={() => handlePositionChange(pos.id)}
                      style={{ marginRight: '8px' }}
                    />
                    {pos.name}
                  </label>
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Vaqt chegarasi (daqiqa):
              </label>
              <input
                type="number"
                className="input"
                value={formData.time_limit}
                onChange={(e) => setFormData({ ...formData, time_limit: Number(e.target.value) })}
                min="1"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                O'tish balli (%):
              </label>
              <input
                type="number"
                className="input"
                value={formData.passing_score}
                onChange={(e) => setFormData({ ...formData, passing_score: Number(e.target.value) })}
                min="0"
                max="100"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Max urinishlar:
              </label>
              <input
                type="number"
                className="input"
                value={formData.max_attempts}
                onChange={(e) => setFormData({ ...formData, max_attempts: Number(e.target.value) })}
                min="1"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Max trial urinishlar:
              </label>
              <input
                type="number"
                className="input"
                value={formData.max_trial_attempts}
                onChange={(e) => setFormData({ ...formData, max_trial_attempts: Number(e.target.value) })}
                min="1"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Random savollar soni (0 = barcha):
              </label>
              <input
                type="number"
                className="input"
                value={formData.random_questions_count}
                onChange={(e) => setFormData({ ...formData, random_questions_count: Number(e.target.value) })}
                min="0"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Trial savollar soni:
              </label>
              <input
                type="number"
                className="input"
                value={formData.trial_questions_count}
                onChange={(e) => setFormData({ ...formData, trial_questions_count: Number(e.target.value) })}
                min="1"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Test rejimi:
            </label>
            <select
              className="input"
              value={formData.test_mode}
              onChange={(e) => setFormData({ ...formData, test_mode: e.target.value })}
              style={{ width: '100%', margin: 0 }}
            >
              <option value="both">Asosiy va Trial</option>
              <option value="main">Faqat Asosiy</option>
              <option value="trial">Faqat Trial</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.show_answers_immediately}
                onChange={(e) => setFormData({ ...formData, show_answers_immediately: e.target.checked })}
                style={{ marginRight: '8px', width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '600' }}>Javoblarni darhol ko'rsatish</span>
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                style={{ marginRight: '8px', width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '600' }}>Faol</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', alignItems: 'center' }}>
            <span
              onClick={onClose}
              style={{ fontSize: '20px', cursor: saving ? 'not-allowed' : 'pointer', userSelect: 'none', opacity: saving ? 0.5 : 1, color: '#6c757d' }}
              title="Bekor qilish"
            >
              ✕
            </span>
            <span
              onClick={(e) => {
                if (!saving) {
                  const form = e.target.closest('form')
                  if (form) form.requestSubmit()
                }
              }}
              style={{ fontSize: '20px', cursor: saving ? 'not-allowed' : 'pointer', userSelect: 'none', opacity: saving ? 0.5 : 1, color: saving ? '#6c757d' : '#ffc107' }}
              title={saving ? 'Saqlanmoqda...' : 'Saqlash'}
            >
              {saving ? '⏳' : '✓'}
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}

// Create Test Modal Component
function CreateTestModal({ apiBaseUrl, positions, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    position_ids: [],
    time_limit: 60,
    passing_score: 60,
    test_mode: 'both',
    random_questions_count: 0,
    show_answers_immediately: true,
    trial_questions_count: 10,
    max_attempts: 2,
    max_trial_attempts: 1,
    is_active: true
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      setError('Test nomi kiritilishi shart')
      return
    }

    try {
      setSaving(true)
      setError('')
      const token = localStorage.getItem('access_token')
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      const response = await axios.post(
        `${apiBaseUrl}/tests/`,
        {
          ...formData,
          position_ids: formData.position_ids.length > 0 ? formData.position_ids : null
        },
        { headers }
      )

      if (response.data.id) {
        alert('Test muvaffaqiyatli yaratildi!')
        onSuccess()
      }
    } catch (err) {
      console.error('Error creating test:', err)
      setError(err.response?.data?.error || err.response?.data?.detail || 'Test yaratishda xatolik yuz berdi')
    } finally {
      setSaving(false)
    }
  }

  const handlePositionChange = (positionId) => {
    const id = Number(positionId)
    setFormData(prev => ({
      ...prev,
      position_ids: prev.position_ids.includes(id)
        ? prev.position_ids.filter(p => p !== id)
        : [...prev.position_ids, id]
    }))
  }

  return (
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
        maxWidth: '700px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h3 style={{ marginTop: 0 }}>Yangi test qo'shish</h3>
        
        {error && (
          <div className="error" style={{ marginBottom: '20px' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Test nomi *:
            </label>
            <input
              type="text"
              className="input"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              style={{ width: '100%', margin: 0 }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Tavsif:
            </label>
            <textarea
              className="input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              style={{ width: '100%', margin: 0, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Lavozimlar:
            </label>
            <div style={{ 
              border: '1px solid #ddd', 
              borderRadius: '6px', 
              padding: '10px', 
              maxHeight: '150px', 
              overflow: 'auto',
              background: '#f9f9f9'
            }}>
              {positions.length === 0 ? (
                <div style={{ color: '#999', fontStyle: 'italic' }}>Lavozimlar topilmadi</div>
              ) : (
                positions.map(pos => (
                  <label key={pos.id} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.position_ids.includes(pos.id)}
                      onChange={() => handlePositionChange(pos.id)}
                      style={{ marginRight: '8px' }}
                    />
                    {pos.name}
                  </label>
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Vaqt chegarasi (daqiqa):
              </label>
              <input
                type="number"
                className="input"
                value={formData.time_limit}
                onChange={(e) => setFormData({ ...formData, time_limit: Number(e.target.value) })}
                min="1"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                O'tish balli (%):
              </label>
              <input
                type="number"
                className="input"
                value={formData.passing_score}
                onChange={(e) => setFormData({ ...formData, passing_score: Number(e.target.value) })}
                min="0"
                max="100"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Max urinishlar:
              </label>
              <input
                type="number"
                className="input"
                value={formData.max_attempts}
                onChange={(e) => setFormData({ ...formData, max_attempts: Number(e.target.value) })}
                min="1"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Max trial urinishlar:
              </label>
              <input
                type="number"
                className="input"
                value={formData.max_trial_attempts}
                onChange={(e) => setFormData({ ...formData, max_trial_attempts: Number(e.target.value) })}
                min="1"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Random savollar soni (0 = barcha):
              </label>
              <input
                type="number"
                className="input"
                value={formData.random_questions_count}
                onChange={(e) => setFormData({ ...formData, random_questions_count: Number(e.target.value) })}
                min="0"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Trial savollar soni:
              </label>
              <input
                type="number"
                className="input"
                value={formData.trial_questions_count}
                onChange={(e) => setFormData({ ...formData, trial_questions_count: Number(e.target.value) })}
                min="1"
                required
                style={{ width: '100%', margin: 0 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Test rejimi:
            </label>
            <select
              className="input"
              value={formData.test_mode}
              onChange={(e) => setFormData({ ...formData, test_mode: e.target.value })}
              style={{ width: '100%', margin: 0 }}
            >
              <option value="both">Ikkalasi (WebApp va Telegram)</option>
              <option value="webapp">WebApp</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.show_answers_immediately}
                onChange={(e) => setFormData({ ...formData, show_answers_immediately: e.target.checked })}
              />
              <span>Har bir savoldan keyin javob ko'rsatilsin</span>
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <span>Test faol</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', alignItems: 'center' }}>
            <span
              onClick={onClose}
              style={{ fontSize: '20px', cursor: saving ? 'not-allowed' : 'pointer', userSelect: 'none', opacity: saving ? 0.5 : 1, color: '#6c757d' }}
              title="Bekor qilish"
            >
              ✕
            </span>
            <span
              onClick={(e) => {
                if (!saving) {
                  const form = e.target.closest('form')
                  if (form) form.requestSubmit()
                }
              }}
              style={{ fontSize: '20px', cursor: saving ? 'not-allowed' : 'pointer', userSelect: 'none', opacity: saving ? 0.5 : 1, color: saving ? '#6c757d' : '#28a745' }}
              title={saving ? 'Yaratilmoqda...' : 'Yaratish'}
            >
              {saving ? '⏳' : '✓'}
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TestsList

