import { useState, useEffect, createContext, useContext, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' })

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ show: true, msg, type })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000)
  }, [])

  const bg = toast.type === 'danger' ? '#DC2626' : toast.type === 'warning' ? '#D97706' : '#1F2937'

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`toast${toast.show ? ' show' : ''}`} style={{ background: bg }}>
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'currentColor', fill: 'none', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>{toast.msg}</span>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
