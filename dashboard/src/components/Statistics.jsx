import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

function Statistics({ stats }) {
  const COLORS = ['#229ED9', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8', '#6f42c1', '#e83e8c']

  const positionData = stats.tests_by_position?.map(item => ({
    name: item.user__position__name || 'Noma\'lum',
    value: item.count
  })) || []

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Jami testlar</div>
          <div className="stat-value">{stats.total_tests || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">O'rtacha ball</div>
          <div className="stat-value">{stats.avg_score?.toFixed(1) || 0}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Jami foydalanuvchilar</div>
          <div className="stat-value">{stats.total_users || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bugun testlar</div>
          <div className="stat-value">{stats.tests_today || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Hafta testlar</div>
          <div className="stat-value">{stats.tests_this_week || 0}</div>
        </div>
      </div>

      {positionData.length > 0 && (
        <div className="chart-card">
          <h3 style={{ marginBottom: '20px' }}>Lavozimlar bo'yicha testlar</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={positionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#229ED9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats.best_results && stats.best_results.length > 0 && (
        <div className="chart-card">
          <h3 style={{ marginBottom: '20px' }}>Eng yaxshi natijalar</h3>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Foydalanuvchi</th>
                  <th>Test</th>
                  <th>Ball</th>
                  <th>To'g'ri javoblar</th>
                  <th>Sana</th>
                </tr>
              </thead>
              <tbody>
                {stats.best_results.slice(0, 10).map((result) => (
                  <tr key={result.id}>
                    <td>{result.user?.first_name} {result.user?.last_name}</td>
                    <td>{result.test?.title}</td>
                    <td>{result.score}%</td>
                    <td>{result.correct_answers} / {result.total_questions}</td>
                    <td>{new Date(result.completed_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default Statistics

