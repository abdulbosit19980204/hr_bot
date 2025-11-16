import React from 'react'
import './Dashboard.css'

function CVDetail({ cv, apiBaseUrl, onBack }) {
  const downloadCV = () => {
    if (cv.file) {
      // Full URL yaratish
      const fileUrl = cv.file.startsWith('http') 
        ? cv.file 
        : `${apiBaseUrl.replace('/api', '')}${cv.file}`
      window.open(fileUrl, '_blank')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>CV ma'lumotlari</h2>
        <button className="btn" onClick={onBack}>Orqaga</button>
      </div>

      {/* CV Info Card */}
      <div className="table-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '20px' }}>Asosiy ma'lumotlar</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
          <div>
            <strong>CV ID:</strong> {cv.id}
          </div>
          <div>
            <strong>Foydalanuvchi:</strong> {cv.user?.first_name} {cv.user?.last_name}
          </div>
          <div>
            <strong>Telefon:</strong> {cv.user?.phone || '-'}
          </div>
          <div>
            <strong>Email:</strong> {cv.user?.email || '-'}
          </div>
          <div>
            <strong>Lavozim:</strong> {cv.user?.position?.name || '-'}
          </div>
          <div>
            <strong>Fayl nomi:</strong> {cv.file_name || (cv.file ? cv.file.split('/').pop() : '-')}
          </div>
          <div>
            <strong>Fayl hajmi:</strong> {cv.file_size ? `${(cv.file_size / 1024).toFixed(2)} KB` : '-'}
          </div>
          <div>
            <strong>Yuklangan:</strong> {cv.uploaded_at ? new Date(cv.uploaded_at).toLocaleDateString('uz-UZ') : '-'}
          </div>
        </div>
      </div>

      {/* Download Section */}
      <div className="table-card">
        <h3 style={{ marginBottom: '20px' }}>CV fayli</h3>
        {cv.file ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ marginBottom: '20px', fontSize: '18px', color: '#666' }}>
              CV faylini yuklab olish uchun quyidagi tugmani bosing
            </p>
            <button 
              className="btn" 
              onClick={downloadCV}
              style={{ padding: '12px 24px', fontSize: '16px' }}
            >
              📥 CV'ni yuklab olish
            </button>
            <p style={{ marginTop: '20px', fontSize: '14px', color: '#999' }}>
              Fayl yangi oynada ochiladi
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            CV fayli topilmadi
          </div>
        )}
      </div>
    </div>
  )
}

export default CVDetail

