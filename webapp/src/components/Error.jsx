import React from 'react'

function Error({ message }) {
  // Check if message contains HTML tags
  const hasHTML = /<[^>]+>/.test(message)
  
  return (
    <div className="error" style={{ padding: '20px', textAlign: 'left' }}>
      {hasHTML ? (
        <div dangerouslySetInnerHTML={{ __html: message }} />
      ) : (
        <>
          <strong>Xatolik:</strong> {message}
        </>
      )}
    </div>
  )
}

export default Error

