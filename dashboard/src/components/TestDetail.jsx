import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './Dashboard.css'

function TestDetail({ test, apiBaseUrl, onBack }) {
  const [testResults, setTestResults] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadTestData()
  }, [test.id])

  const loadTestData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('access_token')
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Load test results for this test
      const resultsResponse = await axios.get(`${apiBaseUrl}/results/`, {
        params: { test: test.id },
        headers
      })
      setTestResults(resultsResponse.data.results || resultsResponse.data)

      // Calculate statistics
      const results = resultsResponse.data.results || resultsResponse.data
      if (results.length > 0) {
        const totalResults = results.length
        const passedResults = results.filter(r => r.is_passed).length
        const failedResults = totalResults - passedResults
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / totalResults
        const avgCorrect = results.reduce((sum, r) => sum + r.correct_answers, 0) / totalResults
        const avgTotal = results.reduce((sum, r) => sum + r.total_questions, 0) / totalResults

        setStatistics({
          totalResults,
          passedResults,
          failedResults,
          avgScore: avgScore.toFixed(1),
          avgCorrect: avgCorrect.toFixed(1),
          avgTotal: avgTotal.toFixed(1),
          passRate: ((passedResults / totalResults) * 100).toFixed(1)
        })
      } else {
        setStatistics({
          totalResults: 0,
          passedResults: 0,
          failedResults: 0,
          avgScore: 0,
          avgCorrect: 0,
          avgTotal: 0,
          passRate: 0
        })
      }

      setLoading(false)
    } catch (err) {
      console.error('Error loading test data:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('access_token')
        window.location.reload()
      }
      setError(err.response?.data?.error || err.message || 'Xatolik yuz berdi')
      setLoading(false)
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
        <h2>Test ma'lumotlari</h2>
        <button className="btn" onClick={onBack}>Orqaga</button>
      </div>

      {/* Test Info Card */}
      <div className="table-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '20px' }}>Asosiy ma'lumotlar</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
          <div>
            <strong>ID:</strong> {test.id}
          </div>
          <div>
            <strong>Test nomi:</strong> {test.title}
          </div>
          <div>
            <strong>Lavozimlar:</strong> {test.positions && test.positions.length > 0 ? (
              test.positions.map(pos => pos.name).join(', ')
            ) : '-'}
          </div>
          <div>
            <strong>Savollar soni:</strong> {test.questions_count || 0}
          </div>
          <div>
            <strong>Vaqt chegarasi:</strong> {test.time_limit} daqiqa
          </div>
          <div>
            <strong>O'tish balli:</strong> {test.passing_score}%
          </div>
          <div>
            <strong>Max urinishlar:</strong> {test.max_attempts || '-'}
          </div>
          <div>
            <strong>Test rejimi:</strong> {
              test.test_mode === 'telegram' ? 'Telegram' :
              test.test_mode === 'web' ? 'Web' :
              test.test_mode === 'both' ? 'Ikkalasi' : '-'
            }
          </div>
          <div>
            <strong>Holat:</strong> {test.is_active ? (
              <span style={{ color: '#28a745' }}>✅ Faol</span>
            ) : (
              <span style={{ color: '#dc3545' }}>❌ Nofaol</span>
            )}
          </div>
          {test.description && (
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>Tavsif:</strong> {test.description}
            </div>
          )}
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card">
            <div className="stat-label">Jami natijalar</div>
            <div className="stat-value">{statistics.totalResults}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">O'tganlar</div>
            <div className="stat-value" style={{ color: '#28a745' }}>{statistics.passedResults}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">O'tmaganlar</div>
            <div className="stat-value" style={{ color: '#dc3545' }}>{statistics.failedResults}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">O'tish foizi</div>
            <div className="stat-value">{statistics.passRate}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">O'rtacha ball</div>
            <div className="stat-value">{statistics.avgScore}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">O'rtacha to'g'ri javoblar</div>
            <div className="stat-value">{statistics.avgCorrect} / {statistics.avgTotal}</div>
          </div>
        </div>
      )}

      {/* Test Results */}
      <div className="table-card">
        <h3 style={{ marginBottom: '20px' }}>Test natijalari ({testResults.length})</h3>
        {testResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            Bu test uchun natijalar topilmadi
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Foydalanuvchi</th>
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
                  <td>{result.user?.first_name} {result.user?.last_name}</td>
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
    </div>
  )
}

export default TestDetail

