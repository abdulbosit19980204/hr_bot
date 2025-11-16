import React from 'react'
import { Icon } from './Icons'
import './Dashboard.css'

function Pagination({ 
  page, 
  totalPages, 
  totalCount, 
  pageSize, 
  onPageChange, 
  onPageSizeChange 
}) {
  if (totalPages <= 1 && !totalCount) {
    return null
  }

  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else if (page <= 3) {
      for (let i = 1; i <= maxVisible; i++) {
        pages.push(i)
      }
    } else if (page >= totalPages - 2) {
      for (let i = totalPages - 4; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      for (let i = page - 2; i <= page + 2; i++) {
        pages.push(i)
      }
    }
    
    return pages
  }

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        <span className="pagination-total">
          Jami: <strong>{totalCount}</strong>
        </span>
        <div className="pagination-per-page">
          <label>Har sahifada:</label>
          <select
            className="input"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value))
              onPageChange(1)
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
      
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            title="Birinchi sahifa"
          >
            <Icon name="chevron-left" size={16} color="currentColor" />
            <Icon name="chevron-left" size={16} color="currentColor" style={{ marginLeft: '-8px' }} />
          </button>
          <button
            className="pagination-btn"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            title="Oldingi sahifa"
          >
            <Icon name="chevron-left" size={16} color="currentColor" />
          </button>
          
          <div className="pagination-numbers">
            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                className={`pagination-btn ${page === pageNum ? 'active' : ''}`}
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </button>
            ))}
          </div>
          
          <button
            className="pagination-btn"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            title="Keyingi sahifa"
          >
            <Icon name="chevron-right" size={16} color="currentColor" />
          </button>
          <button
            className="pagination-btn"
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages}
            title="Oxirgi sahifa"
          >
            <Icon name="chevron-right" size={16} color="currentColor" />
            <Icon name="chevron-right" size={16} color="currentColor" style={{ marginLeft: '-8px' }} />
          </button>
        </div>
      )}
    </div>
  )
}

export default Pagination

