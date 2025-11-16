import React from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts'

function Statistics({ stats }) {
  // Modern premium color palette
  const COLORS = ['#229ED9', '#2ECC71', '#F1C40F', '#E74C3C', '#3498DB', '#9B59B6', '#1ABC9C', '#E67E22']
  const PRIMARY_COLOR = '#229ED9'
  const PRIMARY_DARK = '#1A7FB3'

  // Format daily test completions for LineChart
  const dailyTestData = stats.daily_test_completions?.map(item => ({
    date: new Date(item.date).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
    count: item.count
  })) || []

  // Trial vs Real pie chart data
  const trialVsRealData = stats.trial_vs_real ? [
    { name: 'Trial', value: stats.trial_vs_real.trial_count, avgScore: stats.trial_vs_real.trial_avg_score },
    { name: 'Real', value: stats.trial_vs_real.real_count, avgScore: stats.trial_vs_real.real_avg_score }
  ] : []

  // Tests by position (new format)
  const positionData = stats.tests_by_position?.map(item => ({
    name: item.test__positions__name || 'Noma\'lum',
    count: item.count,
    avgScore: item.avg_score || 0
  })) || []

  // Top notification errors
  const errorData = stats.top_notification_errors?.map(item => ({
    name: item.error_type || 'Noma\'lum',
    count: item.count
  })) || []

  return (
    <div>
      {/* A. Real-time Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Bugun testlar</div>
          <div className="stat-value">{stats.tests_today || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Yangi foydalanuvchilar (bugun)</div>
          <div className="stat-value">{stats.new_users_today || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">CV yuklangan (bugun)</div>
          <div className="stat-value">{stats.cv_uploads_today || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Faol foydalanuvchilar</div>
          <div className="stat-value">{stats.active_users || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bloklangan foydalanuvchilar</div>
          <div className="stat-value">{stats.blocked_users || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">O'rtacha ball</div>
          <div className="stat-value">{stats.avg_score?.toFixed(1) || 0}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">O'tish foizi</div>
          <div className="stat-value">{stats.pass_rate?.toFixed(1) || 0}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Jami testlar</div>
          <div className="stat-value">{stats.total_tests || 0}</div>
        </div>
      </div>

      {/* B. Trend Charts */}
      {dailyTestData.length > 0 && (
        <div className="chart-card">
          <h3 style={{ marginBottom: '20px' }}>Kunlik test natijalari (7 kun)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyTestData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E6" opacity={0.5} />
              <XAxis dataKey="date" stroke="#888888" fontSize={12} />
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
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke={PRIMARY_COLOR} 
                strokeWidth={2}
                dot={{ fill: PRIMARY_COLOR, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* User Growth Stats */}
      {stats.user_growth && (
        <div className="chart-card">
          <h3 style={{ marginBottom: '20px' }}>Foydalanuvchilar o'sishi</h3>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="stat-card">
              <div className="stat-label">Bugun</div>
              <div className="stat-value">{stats.user_growth.today || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Bu hafta</div>
              <div className="stat-value">{stats.user_growth.this_week || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Bu oy</div>
              <div className="stat-value">{stats.user_growth.this_month || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* C. Comparison Stats - Trial vs Real */}
      {trialVsRealData.length > 0 && (
        <div className="chart-card">
          <h3 style={{ marginBottom: '20px' }}>Trial vs Real testlar</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={trialVsRealData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {trialVsRealData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#555', marginBottom: '4px' }}>Trial testlar</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: PRIMARY_COLOR }}>
                  {stats.trial_vs_real?.trial_avg_score?.toFixed(1) || 0}%
                </div>
                <div style={{ fontSize: '12px', color: '#888' }}>O'rtacha ball</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#555', marginBottom: '4px' }}>Real testlar</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: PRIMARY_DARK }}>
                  {stats.trial_vs_real?.real_avg_score?.toFixed(1) || 0}%
                </div>
                <div style={{ fontSize: '12px', color: '#888' }}>O'rtacha ball</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tests by Position */}
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
                dataKey="count" 
                fill="url(#colorGradient)" 
                radius={[6, 6, 0, 0]}
              >
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PRIMARY_COLOR} />
                    <stop offset="100%" stopColor={PRIMARY_DARK} />
                  </linearGradient>
                </defs>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Hardest/Easiest Tests */}
      {(stats.hardest_tests?.length > 0 || stats.easiest_tests?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {stats.hardest_tests?.length > 0 && (
            <div className="chart-card">
              <h3 style={{ marginBottom: '20px' }}>Eng qiyin testlar</h3>
              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>O'rtacha ball</th>
                      <th>Natijalar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.hardest_tests.slice(0, 10).map((test, idx) => (
                      <tr key={idx}>
                        <td>{test.test__title || 'Noma\'lum'}</td>
                        <td><strong>{test.avg_score?.toFixed(1) || 0}%</strong></td>
                        <td>{test.count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {stats.easiest_tests?.length > 0 && (
            <div className="chart-card">
              <h3 style={{ marginBottom: '20px' }}>Eng oson testlar</h3>
              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>O'rtacha ball</th>
                      <th>Natijalar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.easiest_tests.slice(0, 10).map((test, idx) => (
                      <tr key={idx}>
                        <td>{test.test__title || 'Noma\'lum'}</td>
                        <td><strong>{test.avg_score?.toFixed(1) || 0}%</strong></td>
                        <td>{test.count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* D. Performance Metrics */}
      <div className="chart-card">
        <h3 style={{ marginBottom: '20px' }}>Performance metrikalari</h3>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="stat-card">
            <div className="stat-label">O'rtacha vaqt/test</div>
            <div className="stat-value">{stats.avg_time_per_test ? `${stats.avg_time_per_test.toFixed(0)}s` : '0s'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">O'rtacha urinishlar/foydalanuvchi</div>
            <div className="stat-value">{stats.avg_attempts_per_user?.toFixed(1) || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ko'p urinishlar</div>
            <div className="stat-value">{stats.users_with_multiple_attempts || 0}</div>
          </div>
        </div>
      </div>

      {/* F. CV Statistics */}
      <div className="chart-card">
        <h3 style={{ marginBottom: '20px' }}>CV statistikasi</h3>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="stat-card">
            <div className="stat-label">Jami CV'lar</div>
            <div className="stat-value">{stats.total_cvs || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Bu hafta</div>
            <div className="stat-value">{stats.cvs_this_week || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">O'rtacha fayl hajmi</div>
            <div className="stat-value">{stats.avg_file_size ? `${stats.avg_file_size.toFixed(1)} KB` : '0 KB'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">CV yuklagan foydalanuvchilar</div>
            <div className="stat-value">{stats.users_with_cv || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">O'tgan + CV</div>
            <div className="stat-value">{stats.users_passed_and_cv || 0}</div>
          </div>
        </div>
      </div>

      {/* G. Notifications */}
      <div className="chart-card">
        <h3 style={{ marginBottom: '20px' }}>Xabarlar statistikasi</h3>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="stat-card">
            <div className="stat-label">Jami xabarlar</div>
            <div className="stat-value">{stats.total_notifications || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Yuborilgan</div>
            <div className="stat-value">{stats.sent_notifications || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Qoralama</div>
            <div className="stat-value">{stats.draft_notifications || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Muvaffaqiyatli yuborilgan</div>
            <div className="stat-value">{stats.total_successful_sends || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Muvaffaqiyat foizi</div>
            <div className="stat-value">{stats.success_rate?.toFixed(1) || 0}%</div>
          </div>
        </div>
        {errorData.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Top xatoliklar</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={errorData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E6" opacity={0.5} />
                <XAxis type="number" stroke="#888888" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} width={120} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E6E6E6',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
                    padding: '12px'
                  }}
                />
                <Bar dataKey="count" fill="#E74C3C" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Best Results Table */}
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
                    <td>{result.user_name || 'Noma\'lum'}</td>
                    <td>{result.test_title || 'Noma\'lum'}</td>
                    <td><strong>{result.score}%</strong></td>
                    <td>{result.correct_answers} / {result.total_questions}</td>
                    <td>{result.completed_at ? new Date(result.completed_at).toLocaleDateString('uz-UZ') : '-'}</td>
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
