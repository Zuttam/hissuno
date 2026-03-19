'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'hissuno-copilot-open'

interface CopilotContextValue {
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
}

const CopilotContext = createContext<CopilotContextValue | null>(null)

export function useCopilot(): CopilotContextValue {
  const context = useContext(CopilotContext)
  if (!context) {
    throw new Error('useCopilot must be used within a CopilotProvider')
  }
  return context
}

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === null ? true : stored === 'true'
  })

  // Persist open/closed state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isOpen))
  }, [isOpen])

  // Keyboard shortcuts: Cmd+. to toggle, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '.') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo(() => ({ isOpen, toggle, open, close }), [isOpen, toggle, open, close])

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>
}
