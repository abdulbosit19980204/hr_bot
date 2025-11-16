import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

function Statistics({ stats }) {
  // Modern premium color palette
  const COLORS = ['#229ED9', '#2ECC71', '#F1C40F', '#E74C3C', '#3498DB', '#9B59B6', '#1ABC9C', '#E67E22']

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
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E6" opacity={0.5} />
              <XAxis dataKey="name" stroke="#888888" fontSize={12} />
              <YAxis stroke="#888888" fontSize={12} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E6E6E6',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
                  padding: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '13px', color: '#555555' }} />
              <Bar 
                dataKey="value" 
                fill="url(#colorGradient)" 
                radius={[6, 6, 0, 0]}
              >
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#229ED9" />
                    <stop offset="100%" stopColor="#1A7FB3" />
                  </linearGradient>
                </defs>
              </Bar>
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

