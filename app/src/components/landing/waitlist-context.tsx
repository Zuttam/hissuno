'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface WaitlistContextValue {
  isOpen: boolean
  openWaitlistDialog: () => void
  closeWaitlistDialog: () => void
}

const WaitlistContext = createContext<WaitlistContextValue | null>(null)

export function WaitlistProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openWaitlistDialog = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeWaitlistDialog = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <WaitlistContext.Provider value={{ isOpen, openWaitlistDialog, closeWaitlistDialog }}>
      {children}
    </WaitlistContext.Provider>
  )
}

export function useWaitlist() {
  const context = useContext(WaitlistContext)
  if (!context) {
    throw new Error('useWaitlist must be used within a WaitlistProvider')
  }
  return context
}
