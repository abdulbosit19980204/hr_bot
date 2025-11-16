import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './Dashboard.css'

function UserDetail({ user, apiBaseUrl, onBack }) {
  const [testResults, setTestResults] = useState([])
  const [cvs, setCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadUserData()
  }, [user.id])

  const loadUserData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('access_token')
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Load test results
      const resultsResponse = await axios.get(`${apiBaseUrl}/results/`, {
        params: { user: user.id },
        headers
      })
      setTestResults(resultsResponse.data.results || resultsResponse.data)

      // Load CVs
      const cvsResponse = await axios.get(`${apiBaseUrl}/cvs/`, {
        params: { user: user.id },
        headers
      })
      setCvs(cvsResponse.data.results || cvsResponse.data)

      setLoading(false)
    } catch (err) {
      console.error('Error loading user data:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('access_token')
        window.location.reload()
      }
      setError(err.response?.data?.error || err.message || 'Xatolik yuz berdi')
      setLoading(false)
    }
  }

  const downloadCV = (cv) => {
    if (cv.file) {
      window.open(cv.file, '_blank')
    }
  }

  if (loading) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  if (error) {
    return (
      <div>
        <div className="error">{error}</div>
        <button className="btn" onClick={onBack} style={{ marginTop: '20px' }}>
          Orqaga
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Foydalanuvchi ma'lumotlari</h2>
        <button className="btn" onClick={onBack}>Orqaga</button>
      </div>

      {/* User Info Card */}
      <div className="table-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '20px' }}>Asosiy ma'lumotlar</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
          <div>
            <strong>ID:</strong> {user.id}
          </div>
          <div>
            <strong>Ism:</strong> {user.first_name || '-'}
          </div>
          <div>
            <strong>Familiya:</strong> {user.last_name || '-'}
          </div>
          <div>
            <strong>Telefon:</strong> {user.phone || '-'}
          </div>
          <div>
            <strong>Email:</strong> {user.email || '-'}
          </div>
          <div>
            <strong>Lavozim:</strong> {user.position?.name || '-'}
          </div>
          <div>
            <strong>Telegram ID:</strong> {user.telegram_id || '-'}
          </div>
          <div>
            <strong>Holat:</strong> {user.is_blocked ? (
              <span style={{ color: '#dc3545' }}>🚫 Bloklangan</span>
            ) : (
              <span style={{ color: '#28a745' }}>✅ Faol</span>
            )}
          </div>
          {user.is_blocked && user.blocked_reason && (
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>Bloklanish sababi:</strong> {user.blocked_reason}
            </div>
          )}
          <div>
            <strong>Ro'yxatdan o'tgan:</strong> {user.created_at ? new Date(user.created_at).toLocaleDateString('uz-UZ') : '-'}
          </div>
        </div>
      </div>

      {/* Test Results */}
      <div className="table-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '20px' }}>Test natijalari ({testResults.length})</h3>
        {testResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            Test natijalari topilmadi
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Test</th>
                <th>Ball</th>
                <th>To'g'ri javoblar</th>
                <th>Status</th>
                <th>Urinish</th>
                <th>Yakunlangan</th>
              </tr>
            </thead>
            <tbody>
              {testResults.map((result) => (
                <tr key={result.id}>
                  <td>{result.test?.title || '-'}</td>
                  <td>{result.score}%</td>
                  <td>{result.correct_answers} / {result.total_questions}</td>
                  <td>
                    {result.is_passed ? (
                      <span style={{ color: '#28a745' }}>✅ O'tdi</span>
                    ) : (
                      <span style={{ color: '#dc3545' }}>❌ O'tmadi</span>
                    )}
                  </td>
                  <td>{result.attempt_number || '-'}</td>
                  <td>{result.completed_at ? new Date(result.completed_at).toLocaleDateString('uz-UZ') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CVs */}
      <div className="table-card">
        <h3 style={{ marginBottom: '20px' }}>CV'lar ({cvs.length})</h3>
        {cvs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            CV'lar topilmadi
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fayl nomi</th>
                <th>Yuklangan</th>
                <th>Harakatlar</th>
              </tr>
            </thead>
            <tbody>
              {cvs.map((cv) => (
                <tr key={cv.id}>
                  <td>{cv.file ? cv.file.split('/').pop() : '-'}</td>
                  <td>{cv.uploaded_at ? new Date(cv.uploaded_at).toLocaleDateString('uz-UZ') : '-'}</td>
                  <td>
                    {cv.file && (
                      <button 
                        className="btn" 
                        onClick={() => downloadCV(cv)}
                        style={{ padding: '6px 12px', fontSize: '14px' }}
                      >
                        Yuklab olish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default UserDetail

