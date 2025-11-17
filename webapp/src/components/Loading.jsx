import React from 'react'
import { Icon } from './Icons'

function Loading() {
  return (
    <div className="loading">
      <div className="loading-spinner">
        <Icon name="loader" size={40} color="var(--primary)" />
      </div>
      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--text-secondary)' }}>
        Yuklanmoqda...
      </div>
    </div>
  )
}

export default Loading

