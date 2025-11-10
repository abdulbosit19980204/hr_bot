import React, { useState } from 'react'
import axios from 'axios'

function CVUploadPage({ user, apiBaseUrl }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState(null)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      // Check file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Faqat PDF yoki DOCX formatidagi fayllar qabul qilinadi')
        return
      }
      
      // Check file size (10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('Fayl hajmi 10MB dan oshmasligi kerak')
        return
      }
      
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
      if (!allowedTypes.includes(droppedFile.type)) {
        setError('Faqat PDF yoki DOCX formatidagi fayllar qabul qilinadi')
        return
      }
      
      if (droppedFile.size > 10 * 1024 * 1024) {
        setError('Fayl hajmi 10MB dan oshmasligi kerak')
        return
      }
      
      setFile(droppedFile)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Iltimos, fayl tanlang')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      await axios.post(`${apiBaseUrl}/cvs/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setUploaded(true)
      setFile(null)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.response?.data?.error || 'CV yuklashda xatolik yuz berdi')
    } finally {
      setUploading(false)
    }
  }

  if (uploaded) {
    return (
      <div>
        <div className="card result-card">
          <div className="success">
            <h2>✅ CV muvaffaqiyatli yuklandi!</h2>
            <p style={{ marginTop: '16px' }}>
              Sizning ma'lumotlaringiz va natijalaringiz saqlandi.
              Tez orada siz bilan bog'lanamiz.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <h2 style={{ marginBottom: '16px' }}>CV yuklash</h2>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          Iltimos, CV faylingizni yuklang (PDF yoki DOCX formatida, maksimal 10MB)
        </p>

        {error && <div className="error">{error}</div>}

        <div
          className={`file-upload ${file ? 'dragover' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input').click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          {file ? (
            <div>
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>📄 {file.name}</div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📎</div>
              <div>Fayl tanlang yoki bu yerga tashlang</div>
            </div>
          )}
        </div>

        {file && (
          <button
            className="btn"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Yuklanmoqda...' : 'CV ni yuklash'}
          </button>
        )}
      </div>
    </div>
  )
}

export default CVUploadPage

