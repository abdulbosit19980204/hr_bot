import React from 'react'
import { Icon } from './Icons'

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
        <h2 style={{ 
          marginBottom: 'var(--space-xl)', 
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--text-primary)'
        }}>
          Test natijasi
        </h2>
        
        <div className="result-score">
          {score}%
        </div>
        
        <div className={`result-status ${isPassed ? 'passed' : 'failed'}`} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-lg)'
        }}>
          <Icon 
            name={isPassed ? 'check-circle' : 'alert-circle'} 
            size={28} 
            color={isPassed ? 'var(--success)' : 'var(--error)'} 
          />
          {isPassed ? 'O\'tdi' : 'O\'tmadi'}
        </div>
        
        <div style={{ 
          marginTop: 'var(--space-xl)', 
          fontSize: 'var(--font-size-base)', 
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: 'var(--space-md)',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)'
          }}>
            <span>To'g'ri javoblar:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {correctAnswers} / {totalQuestions}
            </strong>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: 'var(--space-md)',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)'
          }}>
            <span>Minimal ball:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {test.passing_score}%
            </strong>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ 
          marginBottom: 'var(--space-lg)', 
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--text-primary)'
        }}>
          Test ma'lumotlari
        </h3>
        <div style={{ 
          fontSize: 'var(--font-size-sm)', 
          color: 'var(--text-secondary)', 
          lineHeight: '1.8',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            paddingBottom: 'var(--space-sm)',
            borderBottom: '1px solid var(--border-light)'
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>Test:</strong>
            <span style={{ textAlign: 'right' }}>{test.title}</span>
          </div>
          {test.description && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              paddingBottom: 'var(--space-sm)',
              borderBottom: '1px solid var(--border-light)'
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>Tavsif:</strong>
              <span style={{ textAlign: 'right' }}>{test.description}</span>
            </div>
          )}
          {test.position && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 'var(--space-md)'
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>Lavozim:</strong>
              <span style={{ textAlign: 'right' }}>{test.position}</span>
            </div>
          )}
        </div>
      </div>

      {isPassed && (
        <button className="btn btn-primary" onClick={onContinue} style={{ marginTop: 'var(--space-lg)' }}>
          <Icon name="upload" size={18} color="white" />
          CV yuklash
        </button>
      )}
    </div>
  )
}

export default ResultPage

