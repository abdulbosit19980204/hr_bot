import React from 'react'
import { Icon } from './Icons'

function Error({ message }) {
  // Check if message contains HTML tags
  const hasHTML = /<[^>]+>/.test(message)
  
  return (
    <div className="error" style={{ 
      padding: 'var(--space-2xl)', 
      textAlign: 'left',
      display: 'flex',
      gap: 'var(--space-md)',
      alignItems: 'flex-start'
    }}>
      <Icon name="alert-circle" size={24} color="var(--error)" style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1 }}>
        {hasHTML ? (
          <div dangerouslySetInnerHTML={{ __html: message }} />
        ) : (
          <>
            <strong style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>Xatolik:</strong>
            <div>{message}</div>
          </>
        )}
      </div>
    </div>
  )
}

export default Error

