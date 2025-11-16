import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './Dashboard.css'

function TestDetail({ test, apiBaseUrl, onBack }) {
  const [testResults, setTestResults] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [testDetails, setTestDetails] = useState(null)
  const [showQuestions, setShowQuestions] = useState(false)
  const [questions, setQuestions] = useState([])
  const [questionsPage, setQuestionsPage] = useState(1)
  const [questionsPageSize, setQuestionsPageSize] = useState(20)
  const [questionsTotalPages, setQuestionsTotalPages] = useState(1)
  const [questionsCount, setQuestionsCount] = useState(0)
  const [isSuperuser, setIsSuperuser] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    loadTestData()
    checkSuperuser()
    
    // Scroll event listener for "Top" button
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true)
      } else {
        setShowScrollTop(false)
      }
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [test.id])
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (showQuestions && isSuperuser) {
      loadQuestions()
    }
  }, [showQuestions, questionsPage, questionsPageSize, isSuperuser])

  const checkSuperuser = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      // Try to get user info from token or check permissions
      // We'll check by trying to access a superuser-only endpoint
      const response = await axios.get(`${apiBaseUrl}/tests/${test.id}/questions_list/`, { 
        headers,
        params: { page: 1, page_size: 1 }
      })
      setIsSuperuser(true)
    } catch (err) {
      if (err.response?.status === 403) {
        setIsSuperuser(false)
      } else {
        // If endpoint doesn't exist or other error, assume not superuser
        setIsSuperuser(false)
      }
    }
  }

  const loadQuestions = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await axios.get(`${apiBaseUrl}/tests/${test.id}/questions_list/`, {
        params: { 
          page: questionsPage,
          page_size: questionsPageSize
        },
        headers
      })
      
      setQuestions(response.data.results || [])
      setQuestionsCount(response.data.count || 0)
      if (response.data.count) {
        setQuestionsTotalPages(Math.ceil(response.data.count / questionsPageSize))
      }
    } catch (err) {
      console.error('Error loading questions:', err)
      if (err.response?.status === 403) {
        setIsSuperuser(false)
        setShowQuestions(false)
        alert('Bu funksiya faqat super userlar uchun')
      }
    }
  }

  const exportQuestions = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const headers = {
        'Authorization': `Bearer ${token}`,
        'responseType': 'blob'
      }
      
      // Export to Excel
      const response = await axios.get(
        `${apiBaseUrl}/tests/${test.id}/export_questions/`,
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob'
        }
      )
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition']
      let filename = `test_${test.id}_questions_${new Date().toISOString().split('T')[0]}.xlsx`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      alert('Savollar muvaffaqiyatli Excel formatida export qilindi!')
    } catch (err) {
      console.error('Error exporting questions:', err)
      alert(err.response?.data?.error || 'Savollarni export qilishda xatolik yuz berdi')
    }
  }

  const handleImportQuestions = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Faqat Excel fayllar (.xlsx, .xls) qabul qilinadi!')
      e.target.value = '' // Reset file input
      return
    }
    
    try {
      // Confirm import - test mavjud, faqat savollar import qilinadi
      if (!window.confirm(`Mavjud testga savollarni import qilishni tasdiqlaysizmi?\n(Test ma'lumotlari o'zgartirilmaydi, faqat savollar qo'shiladi)`)) {
        e.target.value = '' // Reset file input
        return
      }
      
      const token = localStorage.getItem('access_token')
      
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('file', file)
      
      // Send to backend - import questions to existing test
      const response = await axios.post(
        `${apiBaseUrl}/tests/${test.id}/import_questions/`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      )
      
      if (response.data.success) {
        const msg = `Muvaffaqiyatli import qilindi: ${response.data.imported_count} ta savol`
        if (response.data.errors && response.data.errors.length > 0) {
          alert(`${msg}\n\nXatoliklar:\n${response.data.errors.slice(0, 10).join('\n')}${response.data.errors.length > 10 ? `\n... va yana ${response.data.errors.length - 10} ta xatolik` : ''}`)
        } else {
          alert(msg)
        }
        
        // Reload questions
        if (showQuestions) {
          loadQuestions()
        }
        // Reload test data to update questions count
        loadTestData()
      }
      
      e.target.value = '' // Reset file input
    } catch (err) {
      console.error('Error importing questions:', err)
      alert(err.response?.data?.error || 'Savollarni import qilishda xatolik yuz berdi')
      e.target.value = '' // Reset file input
    }
  }

  const handleEditQuestion = (question) => {
    setEditingQuestion({
      id: question.id,
      text: question.text,
      order: question.order,
      options: question.options ? [...question.options].sort((a, b) => (a.order || 0) - (b.order || 0)) : []
    })
    setShowEditModal(true)
  }

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Bu savolni o\'chirishni tasdiqlaysizmi?')) {
      return
    }
    
    try {
      const token = localStorage.getItem('access_token')
      await axios.delete(`${apiBaseUrl}/questions/${questionId}/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      alert('Savol muvaffaqiyatli o\'chirildi!')
      loadQuestions()
    } catch (err) {
      console.error('Error deleting question:', err)
      alert(err.response?.data?.error || 'Savolni o\'chirishda xatolik yuz berdi')
    }
  }

  const handleSaveQuestion = async () => {
    if (!editingQuestion || !editingQuestion.text.trim()) {
      alert('Savol matni bo\'sh bo\'lmasligi kerak!')
      return
    }
    
    // Validate options
    if (!editingQuestion.options || editingQuestion.options.length < 2) {
      alert('Kamida 2 ta javob varianti bo\'lishi kerak!')
      return
    }
    
    // Check if at least one option is correct
    const hasCorrectOption = editingQuestion.options.some(opt => opt.is_correct)
    if (!hasCorrectOption) {
      alert('Kamida bitta to\'g\'ri javob belgilanishi kerak!')
      return
    }
    
    try {
      const token = localStorage.getItem('access_token')
      const questionData = {
        text: editingQuestion.text,
        order: editingQuestion.order || 0,
        test: test.id,
        options: editingQuestion.options.map((opt, idx) => ({
          text: opt.text,
          is_correct: opt.is_correct,
          order: idx + 1
        }))
      }
      
      if (editingQuestion.id) {
        // Update existing question
        await axios.put(`${apiBaseUrl}/questions/${editingQuestion.id}/`, questionData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        alert('Savol muvaffaqiyatli yangilandi!')
      } else {
        // Create new question
        await axios.post(`${apiBaseUrl}/questions/`, questionData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        alert('Savol muvaffaqiyatli qo\'shildi!')
      }
      
      setShowEditModal(false)
      setEditingQuestion(null)
      loadQuestions()
    } catch (err) {
      console.error('Error saving question:', err)
      alert(err.response?.data?.error || 'Savolni saqlashda xatolik yuz berdi')
    }
  }

  const handleAddOption = () => {
    if (!editingQuestion) return
    setEditingQuestion({
      ...editingQuestion,
      options: [...(editingQuestion.options || []), { text: '', is_correct: false, order: (editingQuestion.options?.length || 0) + 1 }]
    })
  }

  const handleRemoveOption = (index) => {
    if (!editingQuestion || !editingQuestion.options) return
    const newOptions = editingQuestion.options.filter((_, i) => i !== index)
    setEditingQuestion({
      ...editingQuestion,
      options: newOptions
    })
  }

  const handleOptionChange = (index, field, value) => {
    if (!editingQuestion || !editingQuestion.options) return
    const newOptions = [...editingQuestion.options]
    newOptions[index] = { ...newOptions[index], [field]: value }
    setEditingQuestion({
      ...editingQuestion,
      options: newOptions
    })
  }

  const loadTestData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('access_token')
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Load full test details (without questions for superuser view)
      const testResponse = await axios.get(`${apiBaseUrl}/tests/${test.id}/`, { headers })
      setTestDetails(testResponse.data)
      
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

      {/* Test Questions */}
      {isSuperuser && (
        <div className="table-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0 }}>Test savollari ({questionsCount || testDetails?.questions_count || 0})</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {showQuestions && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: '#666' }}>Har sahifada:</label>
                    <select
                      className="input"
                      value={questionsPageSize}
                      onChange={(e) => {
                        setQuestionsPageSize(Number(e.target.value))
                        setQuestionsPage(1) // Reset to first page when changing page size
                      }}
                      style={{ width: '80px', margin: 0, padding: '6px' }}
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                  <span
                    onClick={exportQuestions}
                    style={{ fontSize: '18px', cursor: 'pointer', userSelect: 'none', color: '#28a745' }}
                    title="Export qilish (Excel)"
                  >
                    ⬇
                  </span>
                  <label style={{ fontSize: '18px', cursor: 'pointer', userSelect: 'none', color: '#229ED9' }} title="Import qilish (Excel)">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      style={{ display: 'none' }}
                      onChange={handleImportQuestions}
                    />
                    ⬆
                  </label>
                </>
              )}
              <button 
                className="btn" 
                onClick={() => setShowQuestions(!showQuestions)}
                style={{ background: showQuestions ? '#6c757d' : '#229ED9' }}
              >
                {showQuestions ? 'Yashirish' : 'Ko\'rsatish'}
              </button>
            </div>
          </div>
          
          {showQuestions && (
            <div>
              {isSuperuser && (
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setEditingQuestion({
                        id: null,
                        text: '',
                        order: questionsCount + 1,
                        options: [
                          { text: '', is_correct: false, order: 1 },
                          { text: '', is_correct: false, order: 2 }
                        ]
                      })
                      setShowEditModal(true)
                    }}
                    style={{
                      padding: '10px 20px',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    + Yangi savol qo'shish
                  </button>
                </div>
              )}
              {questions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  Bu testda savollar topilmadi
                  {isSuperuser && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={() => {
                          setEditingQuestion({
                            id: null,
                            text: '',
                            order: 1,
                            options: [
                              { text: '', is_correct: false, order: 1 },
                              { text: '', is_correct: false, order: 2 }
                            ]
                          })
                          setShowEditModal(true)
                        }}
                        style={{
                          padding: '10px 20px',
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        + Birinchi savolni qo'shish
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Pagination at top */}
                  {questionsTotalPages > 1 && (
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                      <button
                        className="btn"
                        onClick={() => {
                          setQuestionsPage(questionsPage - 1)
                          scrollToTop()
                        }}
                        disabled={questionsPage === 1}
                      >
                        Oldingi
                      </button>
                      <span style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                        {questionsPage} / {questionsTotalPages}
                      </span>
                      <button
                        className="btn"
                        onClick={() => {
                          setQuestionsPage(questionsPage + 1)
                          scrollToTop()
                        }}
                        disabled={questionsPage === questionsTotalPages}
                      >
                        Keyingi
                      </button>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '20px' }}>
                    {questions.map((question, index) => {
                      const globalIndex = (questionsPage - 1) * questionsPageSize + index
                      return (
                        <div 
                          key={question.id} 
                          style={{ 
                            border: '1px solid #e0e0e0', 
                            borderRadius: '8px', 
                            padding: '20px',
                            background: '#fafafa'
                          }}
                        >
                          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <strong style={{ fontSize: '16px', color: '#333', flex: 1 }}>
                              {globalIndex + 1}. {question.text}
                            </strong>
                            {isSuperuser && (
                              <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                                <button
                                  onClick={() => handleEditQuestion(question)}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#229ED9',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                  }}
                                  title="Tahrirlash"
                                >
                                  ✏
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(question.id)}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                  }}
                                  title="O'chirish"
                                >
                                  🗑
                                </button>
                              </div>
                            )}
                          </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {question.options && question.options.length > 0 ? (
                        question.options
                          .sort((a, b) => (a.order || 0) - (b.order || 0))
                          .map((option, optIndex) => (
                          <div 
                            key={option.id}
                            style={{
                              padding: '12px',
                              borderRadius: '6px',
                              background: option.is_correct ? '#d4edda' : '#fff',
                              border: option.is_correct ? '2px solid #28a745' : '1px solid #ddd',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px'
                            }}
                          >
                            <span style={{ 
                              fontWeight: '600',
                              color: option.is_correct ? '#28a745' : '#666',
                              minWidth: '20px'
                            }}>
                              {String.fromCharCode(65 + optIndex)}.
                            </span>
                            <span style={{ flex: 1 }}>{option.text}</span>
                            {option.is_correct && (
                              <span style={{ 
                                color: '#28a745', 
                                fontWeight: '600',
                                fontSize: '14px'
                              }}>
                                ✓ To'g'ri javob
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: '#999', fontStyle: 'italic' }}>
                          Javob variantlari topilmadi
                        </div>
                          )}
                        </div>
                      </div>
                    )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: '#229ED9',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#1a7ba8'
            e.target.style.transform = 'scale(1.1)'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#229ED9'
            e.target.style.transform = 'scale(1)'
          }}
          title="Yuqoriga chiqish"
        >
          ↑
        </button>
      )}

      {/* Edit Question Modal */}
      {showEditModal && editingQuestion && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '30px',
            maxWidth: '700px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333' }}>
              {editingQuestion.id ? 'Savolni tahrirlash' : 'Yangi savol qo\'shish'}
            </h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Savol matni:
              </label>
              <textarea
                value={editingQuestion.text}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
                placeholder="Savol matnini kiriting..."
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Tartib raqami:
              </label>
              <input
                type="number"
                value={editingQuestion.order || 0}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, order: parseInt(e.target.value) || 0 })}
                style={{
                  width: '100px',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ fontWeight: '600' }}>Javob variantlari:</label>
                <button
                  onClick={handleAddOption}
                  style={{
                    padding: '6px 12px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  + Variant qo'shish
                </button>
              </div>
              
              {editingQuestion.options && editingQuestion.options.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {editingQuestion.options.map((option, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        background: option.is_correct ? '#d4edda' : '#fff'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={option.is_correct}
                        onChange={(e) => handleOptionChange(index, 'is_correct', e.target.checked)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        title="To'g'ri javob"
                      />
                      <input
                        type="text"
                        value={option.text}
                        onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                        placeholder={`Variant ${index + 1}`}
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                      <button
                        onClick={() => handleRemoveOption(index)}
                        style={{
                          padding: '6px 12px',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                        title="O'chirish"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#999', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                  Javob variantlari qo'shilmagan
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingQuestion(null)
                }}
                style={{
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Bekor qilish
              </button>
              <button
                onClick={handleSaveQuestion}
                style={{
                  padding: '10px 20px',
                  background: '#229ED9',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Saqlash
              </button>
            </div>
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

