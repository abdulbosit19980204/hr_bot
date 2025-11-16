import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './Dashboard.css'

function ResultsTable({ apiBaseUrl }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTest, setSelectedTest] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [orderBy, setOrderBy] = useState('-completed_at')
  const [tests, setTests] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    loadTests()
    loadUsers()
  }, [])

  useEffect(() => {
    loadResults()
  }, [page, searchTerm, selectedTest, selectedUser, statusFilter, orderBy])

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
        setTotalPages(Math.ceil(response.data.count / 20))
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
        return true
      })
    : results

  if (loading && results.length === 0) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  return (
    <div className="table-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>Barcha natijalar</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
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
              style={{ width: '150px', margin: 0 }}
            >
              <option value="">Barcha statuslar</option>
              <option value="passed">O'tganlar</option>
              <option value="failed">O'tmaganlar</option>
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
      </div>

      {filteredResults.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Natijalar topilmadi
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Foydalanuvchi</th>
                <th>Email</th>
                <th>Telefon</th>
                <th>Lavozim</th>
                <th>Test</th>
                <th>Ball</th>
                <th>To'g'ri javoblar</th>
                <th>Status</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result) => (
                <tr key={result.id}>
                  <td>{result.user?.first_name} {result.user?.last_name}</td>
                  <td>{result.user?.email || '-'}</td>
                  <td>{result.user?.phone || '-'}</td>
                  <td>{result.user?.position?.name || result.user?.position || '-'}</td>
                  <td>{result.test?.title}</td>
                  <td>{result.score}%</td>
                  <td>{result.correct_answers} / {result.total_questions}</td>
                  <td>
                    {result.is_passed ? (
                      <span style={{ color: '#28a745' }}>✅ O'tdi</span>
                    ) : (
                      <span style={{ color: '#dc3545' }}>❌ O'tmadi</span>
                    )}
                  </td>
                  <td>{new Date(result.completed_at).toLocaleDateString()}</td>
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

export default ResultsTable

