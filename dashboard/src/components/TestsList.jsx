import React, { useState, useEffect } from 'react'
import axios from 'axios'
import TestDetail from './TestDetail'
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
  const [totalPages, setTotalPages] = useState(1)
  const [selectedTest, setSelectedTest] = useState(null)

  useEffect(() => {
    loadPositions()
    loadTests()
  }, [page, searchTerm, selectedPosition, statusFilter])

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
        search: searchTerm || undefined,
        positions: selectedPosition || undefined,
        is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined
      }
      
      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await axios.get(`${apiBaseUrl}/tests/`, {
        params,
        headers
      })
      
      setTests(response.data.results || response.data)
      if (response.data.count) {
        setTotalPages(Math.ceil(response.data.count / 20))
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
    <div className="table-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>Testlar</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
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
      </div>

      {tests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Testlar topilmadi
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Test nomi</th>
                <th>Lavozimlar</th>
                <th>Savollar soni</th>
                <th>Vaqt chegarasi</th>
                <th>O'tish balli</th>
                <th>Max urinishlar</th>
                <th>Holat</th>
                <th>Yaratilgan</th>
                <th>Harakatlar</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr key={test.id}>
                  <td>{test.id}</td>
                  <td>{test.title}</td>
                  <td>
                    {test.positions && test.positions.length > 0 ? (
                      test.positions.map(pos => pos.name).join(', ')
                    ) : '-'}
                  </td>
                  <td>{test.questions_count || 0}</td>
                  <td>{test.time_limit} daqiqa</td>
                  <td>{test.passing_score}%</td>
                  <td>{test.max_attempts || '-'}</td>
                  <td>
                    {test.is_active ? (
                      <span style={{ color: '#28a745' }}>✅ Faol</span>
                    ) : (
                      <span style={{ color: '#dc3545' }}>❌ Nofaol</span>
                    )}
                  </td>
                  <td>{test.created_at ? new Date(test.created_at).toLocaleDateString('uz-UZ') : '-'}</td>
                  <td>
                    <button 
                      className="btn" 
                      onClick={() => handleTestClick(test)}
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

export default TestsList

