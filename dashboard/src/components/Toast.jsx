import React, { useEffect } from 'react'
import './Dashboard.css'

function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const typeStyles = {
    success: { background: 'var(--success)', color: 'white' },
    error: { background: 'var(--error)', color: 'white' },
    warning: { background: 'var(--warning)', color: 'var(--text-primary)' },
    info: { background: 'var(--info)', color: 'white' }
  }

  return (
    <div 
      className="toast"
      style={{
        ...typeStyles[type],
        animation: 'slideDown 0.3s ease-out'
      }}
    >
      <span>{message}</span>
      <button 
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: '4px 8px',
          marginLeft: '12px',
          fontSize: '18px',
          lineHeight: 1
        }}
      >
        ×
      </button>
    </div>
  )
}

export default Toast

