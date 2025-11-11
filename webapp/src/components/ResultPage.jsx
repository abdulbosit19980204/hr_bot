import React from 'react'

function ResultPage({ result, test, onContinue }) {
  if (!result) {
    return <div className="error">Natija topilmadi</div>
  }

  const isPassed = result.is_passed
  const score = result.score
  const correctAnswers = result.correct_answers
  const totalQuestions = result.total_questions

  return (
    <div>
      <div className="card result-card">
        <h2 style={{ marginBottom: '20px' }}>Test natijasi</h2>
        
        <div className="result-score">
          {score}%
        </div>
        
        <div className={`result-status ${isPassed ? 'passed' : 'failed'}`}>
          {isPassed ? '✅ O\'tdi' : '❌ O\'tmadi'}
        </div>
        
        <div style={{ marginTop: '24px', fontSize: '16px', color: '#666' }}>
          <div>To'g'ri javoblar: {correctAnswers} / {totalQuestions}</div>
          <div style={{ marginTop: '8px' }}>
            Minimal ball: {test.passing_score}%
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Test ma'lumotlari</h3>
        <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
          <div><strong>Test:</strong> {test.title}</div>
          {test.description && (
            <div style={{ marginTop: '8px' }}><strong>Tavsif:</strong> {test.description}</div>
          )}
          {test.position && (
            <div style={{ marginTop: '8px' }}><strong>Lavozim:</strong> {test.position}</div>
          )}
        </div>
      </div>

      {isPassed && (
        <button className="btn" onClick={onContinue}>
          CV yuklash
        </button>
      )}
    </div>
  )
}

export default ResultPage

