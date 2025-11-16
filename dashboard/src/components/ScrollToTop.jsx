import React, { useState, useEffect } from 'react'
import { Icon } from './Icons'
import './Dashboard.css'

function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  if (!isVisible) {
    return null
  }

  return (
    <button
      className="scroll-to-top"
      onClick={scrollToTop}
      title="Yuqoriga qaytish"
      aria-label="Yuqoriga qaytish"
    >
      <Icon name="arrow-up" size={20} color="white" />
    </button>
  )
}

export default ScrollToTop

