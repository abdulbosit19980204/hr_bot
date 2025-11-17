import React, { useState } from 'react'
import axios from 'axios'
import { Icon } from './Icons'

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
          <div className="success" style={{ 
            textAlign: 'center',
            padding: 'var(--space-2xl)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-lg)'
          }}>
            <Icon name="check-circle" size={64} color="var(--success)" />
            <h2 style={{ 
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--success)',
              margin: 0
            }}>
              CV muvaffaqiyatli yuklandi!
            </h2>
            <p style={{ 
              marginTop: 'var(--space-md)',
              fontSize: 'var(--font-size-base)',
              color: 'var(--text-secondary)',
              maxWidth: '500px',
              lineHeight: '1.6'
            }}>
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
        <h2 style={{ 
          marginBottom: 'var(--space-lg)', 
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)'
        }}>
          <Icon name="upload" size={24} color="var(--primary)" />
          CV yuklash
        </h2>
        <p style={{ 
          color: 'var(--text-secondary)', 
          marginBottom: 'var(--space-xl)',
          fontSize: 'var(--font-size-base)',
          lineHeight: '1.6'
        }}>
          Iltimos, CV faylingizni yuklang (PDF yoki DOCX formatida, maksimal 10MB)
        </p>

        {error && <div className="error">{error}</div>}

        <div
          className={`file-upload ${file ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input').click()}
          style={{ 
            position: 'relative',
            transition: 'all var(--transition-base)'
          }}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          {file ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: 'var(--space-md)'
            }}>
              <Icon name="file" size={48} color="var(--primary)" />
              <div>
                <div style={{ 
                  fontSize: 'var(--font-size-lg)', 
                  marginBottom: 'var(--space-xs)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--text-primary)'
                }}>
                  {file.name}
                </div>
                <div style={{ 
                  fontSize: 'var(--font-size-sm)', 
                  color: 'var(--text-secondary)'
                }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            </div>
          ) : (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: 'var(--space-md)'
            }}>
              <Icon name="upload" size={64} color="var(--text-tertiary)" />
              <div style={{ 
                fontSize: 'var(--font-size-base)',
                color: 'var(--text-secondary)',
                fontWeight: 'var(--font-weight-medium)'
              }}>
                Fayl tanlang yoki bu yerga tashlang
              </div>
              <div style={{ 
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-tertiary)'
              }}>
                PDF yoki DOCX formatida, maksimal 10MB
              </div>
            </div>
          )}
        </div>

        {file && (
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading}
            style={{ marginTop: 'var(--space-lg)' }}
          >
            {uploading ? (
              <>
                <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
                Yuklanmoqda...
              </>
            ) : (
              <>
                <Icon name="upload" size={18} color="white" />
                CV ni yuklash
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default CVUploadPage

