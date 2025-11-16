import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './Dashboard.css'

function UserDetail({ user, apiBaseUrl, onBack }) {
  const [testResults, setTestResults] = useState([])
  const [cvs, setCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationType, setNotificationType] = useState('interview')
  const [sendingNotification, setSendingNotification] = useState(false)

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

  const handleSendNotification = async () => {
    if (!notificationTitle || !notificationMessage) {
      alert('Iltimos, sarlavha va xabar matnini kiriting')
      return
    }

    if (!user.telegram_id) {
      alert('Bu foydalanuvchining Telegram ID si mavjud emas')
      return
    }

    try {
      setSendingNotification(true)
      const token = localStorage.getItem('access_token')
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      const response = await axios.post(
        `${apiBaseUrl}/notifications/send/`,
        {
          user_ids: [user.id],
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
        <div style={{ display: 'flex', gap: '10px' }}>
          {user.telegram_id && (
            <button 
              className="btn" 
              onClick={() => setShowNotificationModal(true)}
              style={{ background: '#28a745' }}
            >
              📨 Notification yuborish
            </button>
          )}
          <button className="btn" onClick={onBack}>Orqaga</button>
        </div>
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
                <th>Test nomi</th>
                <th>Ball</th>
                <th>To'g'ri javoblar</th>
                <th>Status</th>
                <th>Urinish</th>
                <th>Yakunlangan</th>
              </tr>
            </thead>
            <tbody>
              {testResults
                .sort((a, b) => {
                  // Avval o'tganlarni, keyin o'tmaganlarni ko'rsatish
                  if (a.is_passed !== b.is_passed) {
                    return b.is_passed - a.is_passed
                  }
                  // Keyin ball bo'yicha tartiblash (yuqoridan pastga)
                  return b.score - a.score
                })
                .map((result) => (
                <tr 
                  key={result.id}
                  style={{ 
                    background: result.is_passed ? '#f0f9ff' : (result.score >= 70 ? '#fffbf0' : '')
                  }}
                >
                  <td>
                    <strong>{result.test?.title || '-'}</strong>
                    {result.test?.description && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        {result.test.description.substring(0, 100)}...
                      </div>
                    )}
                  </td>
                  <td>
                    <strong style={{ 
                      color: result.is_passed ? '#28a745' : (result.score >= 70 ? '#ffc107' : '#dc3545'),
                      fontSize: '16px'
                    }}>
                      {result.score}%
                    </strong>
                  </td>
                  <td>{result.correct_answers} / {result.total_questions}</td>
                  <td>
                    {result.is_passed ? (
                      <span style={{ color: '#28a745', fontWeight: '600' }}>✅ O'tdi</span>
                    ) : (
                      <span style={{ color: '#dc3545' }}>❌ O'tmadi</span>
                    )}
                  </td>
                  <td>{result.attempt_number || '-'}</td>
                  <td>{result.completed_at ? new Date(result.completed_at).toLocaleString('uz-UZ') : '-'}</td>
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
              {user.first_name} {user.last_name} ga xabar yuboriladi
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
  )
}

export default UserDetail

