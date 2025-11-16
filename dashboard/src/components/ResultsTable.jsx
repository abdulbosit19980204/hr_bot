import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Icon } from './Icons'
import Pagination from './Pagination'
import './Dashboard.css'

function ResultsTable({ apiBaseUrl }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTest, setSelectedTest] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [orderBy, setOrderBy] = useState('-completed_at')
  const [tests, setTests] = useState([])
  const [users, setUsers] = useState([])
  const [selectedCandidates, setSelectedCandidates] = useState(new Set())
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationType, setNotificationType] = useState('interview')
  const [sendingNotification, setSendingNotification] = useState(false)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [fullView, setFullView] = useState(false)
  
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    user: true,
    email: true,
    phone: true,
    position: true,
    test: true,
    score: true,
    correctAnswers: true,
    status: true,
    date: true
  })

  useEffect(() => {
    loadTests()
    loadUsers()
  }, [])

  useEffect(() => {
    loadResults()
  }, [page, pageSize, searchTerm, selectedTest, selectedUser, statusFilter, orderBy])

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

  const loadTests = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await axios.get(`${apiBaseUrl}/tests/`, { headers })
      setTests(response.data.results || response.data)
    } catch (err) {
      console.error('Error loading tests:', err)
    }
  }

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

  const loadResults = async () => {
    try {
      setLoading(true)
      // Get token from localStorage
      const token = localStorage.getItem('access_token')
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const params = {
        page,
        page_size: pageSize,
        search: searchTerm || undefined,
        test: selectedTest || undefined,
        user: selectedUser || undefined,
        ordering: orderBy
      }
      
      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/results/`, {
        params,
        headers: headers
      })
      setResults(response.data.results || response.data)
      if (response.data.count) {
        setTotalCount(response.data.count)
        setTotalPages(Math.ceil(response.data.count / pageSize))
      }
      setLoading(false)
    } catch (err) {
      console.error('Error loading results:', err)
      if (err.response?.status === 401) {
        // Token expired or invalid, redirect to login
        localStorage.removeItem('access_token')
        window.location.reload()
      }
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    loadResults()
  }

  const handleFilterChange = () => {
    setPage(1)
    loadResults()
  }

  const filteredResults = statusFilter 
    ? results.filter(result => {
        if (statusFilter === 'passed') return result.is_passed
        if (statusFilter === 'failed') return !result.is_passed
        if (statusFilter === 'best') {
          // Eng yaxshi nomzodlar: o'tganlar va balli 80% dan yuqori
          return result.is_passed && result.score >= 80
        }
        return true
      }).sort((a, b) => {
        // Eng yaxshi nomzodlar uchun ball bo'yicha tartiblash (yuqoridan pastga)
        if (statusFilter === 'best') {
          return b.score - a.score
        }
        return 0
      })
    : results

  const handleSelectCandidate = (resultId) => {
    const newSelected = new Set(selectedCandidates)
    if (newSelected.has(resultId)) {
      newSelected.delete(resultId)
    } else {
      newSelected.add(resultId)
    }
    setSelectedCandidates(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedCandidates.size === filteredResults.length) {
      setSelectedCandidates(new Set())
    } else {
      setSelectedCandidates(new Set(filteredResults.map(r => r.id)))
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

  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        alert('Export qilish uchun tizimga kirish kerak')
        return
      }
      
      // Build query params same as current filters
      const params = {
        search: searchTerm || undefined,
        test: selectedTest || undefined,
        user: selectedUser || undefined,
        ordering: orderBy
      }
      
      // Add status filter if needed
      if (statusFilter === 'passed') {
        // We'll filter in backend or handle in frontend
      }
      
      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/results/export_excel/`, {
        params,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob'
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition']
      let filename = `test_results_${new Date().toISOString().split('T')[0]}.xlsx`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      alert('Natijalar muvaffaqiyatli Excel formatida export qilindi!')
    } catch (err) {
      console.error('Error exporting results:', err)
      alert(err.response?.data?.error || 'Natijalarni export qilishda xatolik yuz berdi')
    }
  }

  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        alert('Export qilish uchun tizimga kirish kerak')
        return
      }
      
      // Build query params same as current filters
      const params = {
        search: searchTerm || undefined,
        test: selectedTest || undefined,
        user: selectedUser || undefined,
        ordering: orderBy
      }
      
      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/results/export_csv/`, {
        params,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob'
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition']
      let filename = `test_results_${new Date().toISOString().split('T')[0]}.csv`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      alert('Natijalar muvaffaqiyatli CSV formatida export qilindi!')
    } catch (err) {
      console.error('Error exporting results:', err)
      alert(err.response?.data?.error || 'Natijalarni export qilishda xatolik yuz berdi')
    }
  }

  const handleSendNotification = async () => {
    if (selectedCandidates.size === 0) {
      alert('Iltimos, kamida bitta nomzodni tanlang')
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

      // Get unique user IDs from selected results
      const selectedResults = filteredResults.filter(r => selectedCandidates.has(r.id))
      const userIds = [...new Set(selectedResults.map(r => r.user?.id).filter(Boolean))]

      if (userIds.length === 0) {
        alert('Tanlangan natijalarda foydalanuvchi topilmadi')
        setSendingNotification(false)
        return
      }

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
        setSelectedCandidates(new Set())
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

  if (loading && results.length === 0) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  return (
    <>
      {fullView && (
        <div 
          className={`table-full-view-overlay ${fullView ? 'active' : ''}`}
          onClick={() => setFullView(false)}
        />
      )}
      <div className={`table-card ${fullView ? 'full-view' : ''}`} style={{ position: 'relative' }}>
        <div className="table-header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn-icon"
            onClick={() => setFullView(!fullView)}
            title={fullView ? "Oddiy ko'rinish" : "To'liq ko'rinish"}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setFullView(!fullView)
              }
            }}
          >
            <Icon name={fullView ? "minimize" : "maximize"} size={18} color="currentColor" />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Barcha natijalar</h3>
          {selectedCandidates.size > 0 && (
            <span style={{ 
              background: '#229ED9', 
              color: 'white', 
              padding: '4px 12px', 
              borderRadius: '12px',
              fontSize: '14px'
            }}>
              {selectedCandidates.size} ta tanlangan
            </span>
          )}
        </div>
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
          {selectedCandidates.size > 0 && (
            <button
              className="btn-icon btn-icon-primary"
              onClick={() => setShowNotificationModal(true)}
              title="Tanlangan nomzodlarga notification yuborish"
            >
              <Icon name="bell" size={18} color="currentColor" />
            </button>
          )}
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
        </div>
      </div>

      {/* Filters Section - Toggleable */}
      {showFilters && (
        <div className="table-filters" style={{ 
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
              placeholder="Foydalanuvchi yoki test qidirish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '200px', margin: 0 }}
            />
            <select
              className="input"
              value={selectedTest}
              onChange={(e) => {
                setSelectedTest(e.target.value)
                handleFilterChange()
              }}
              style={{ width: '180px', margin: 0 }}
            >
              <option value="">Barcha testlar</option>
              {tests.map(test => (
                <option key={test.id} value={test.id}>{test.title}</option>
              ))}
            </select>
            <select
              className="input"
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value)
                handleFilterChange()
              }}
              style={{ width: '180px', margin: 0 }}
            >
              <option value="">Barcha foydalanuvchilar</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} {user.phone ? `(${user.phone})` : ''}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                handleFilterChange()
              }}
              style={{ width: '180px', margin: 0 }}
            >
              <option value="">Barcha statuslar</option>
              <option value="passed">O'tganlar</option>
              <option value="failed">O'tmaganlar</option>
              <option value="best">Eng yaxshi nomzodlar</option>
            </select>
            <select
              className="input"
              value={orderBy}
              onChange={(e) => {
                setOrderBy(e.target.value)
                handleFilterChange()
              }}
              style={{ width: '180px', margin: 0 }}
            >
              <option value="-completed_at">Sana (yangi)</option>
              <option value="completed_at">Sana (eski)</option>
              <option value="-score">Ball (yuqori)</option>
              <option value="score">Ball (past)</option>
            </select>
            <button type="submit" className="btn" style={{ margin: 0 }}>Qidirish</button>
            {(searchTerm || selectedTest || selectedUser || statusFilter) && (
              <button 
                type="button"
                className="btn" 
                onClick={() => {
                  setSearchTerm('')
                  setSelectedTest('')
                  setSelectedUser('')
                  setStatusFilter('')
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
            user: 'Foydalanuvchi',
            email: 'Email',
            phone: 'Telefon',
            position: 'Lavozim',
            test: 'Test',
            score: 'Ball',
            correctAnswers: 'To\'g\'ri javoblar',
            status: 'Status',
            date: 'Sana'
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

      {filteredResults.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Natijalar topilmadi
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
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedCandidates.size === filteredResults.length && filteredResults.length > 0}
                      onChange={handleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  {visibleColumns.user && <th>Foydalanuvchi</th>}
                  {visibleColumns.email && <th>Email</th>}
                  {visibleColumns.phone && <th>Telefon</th>}
                  {visibleColumns.position && <th>Lavozim</th>}
                  {visibleColumns.test && <th>Test</th>}
                  {visibleColumns.score && <th>Ball</th>}
                  {visibleColumns.correctAnswers && <th>To'g'ri javoblar</th>}
                  {visibleColumns.status && <th>Status</th>}
                  {visibleColumns.date && <th>Sana</th>}
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((result) => (
                  <tr key={result.id} style={{ background: selectedCandidates.has(result.id) ? 'rgba(34, 158, 217, 0.04)' : '' }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedCandidates.has(result.id)}
                        onChange={() => handleSelectCandidate(result.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    {visibleColumns.user && <td>{result.user?.first_name} {result.user?.last_name}</td>}
                    {visibleColumns.email && <td>{result.user?.email || '-'}</td>}
                    {visibleColumns.phone && <td>{result.user?.phone || '-'}</td>}
                    {visibleColumns.position && <td>{result.user?.position?.name || result.user?.position || '-'}</td>}
                    {visibleColumns.test && <td>{result.test?.title}</td>}
                    {visibleColumns.score && <td>{result.score}%</td>}
                    {visibleColumns.correctAnswers && <td>{result.correct_answers} / {result.total_questions}</td>}
                    {visibleColumns.status && (
                      <td>
                        {result.is_passed ? (
                          <span style={{ color: '#28a745' }}>✅ O'tdi</span>
                        ) : (
                          <span style={{ color: '#dc3545' }}>❌ O'tmadi</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.date && <td>{new Date(result.completed_at).toLocaleDateString()}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              {selectedCandidates.size} ta nomzodga xabar yuboriladi
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
    </>
  )
}

export default ResultsTable

