import React, { useState, useEffect } from 'react'
import axios from 'axios'

function ResultsTable({ apiBaseUrl }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadResults()
  }, [page])

  const loadResults = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/results/`, {
        params: { page }
      })
      setResults(response.data.results || response.data)
      if (response.data.count) {
        setTotalPages(Math.ceil(response.data.count / 20))
      }
      setLoading(false)
    } catch (err) {
      console.error('Error loading results:', err)
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Yuklanmoqda...</div>
  }

  return (
    <div className="table-card">
      <h3 style={{ marginBottom: '20px' }}>Barcha natijalar</h3>
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
          {results.map((result) => (
            <tr key={result.id}>
              <td>{result.user?.first_name} {result.user?.last_name}</td>
              <td>{result.user?.email || '-'}</td>
              <td>{result.user?.phone || '-'}</td>
              <td>{result.user?.position || '-'}</td>
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
    </div>
  )
}

export default ResultsTable

