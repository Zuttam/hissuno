'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { CTAEventData } from '@/lib/event_tracking/types'

type CTASource = CTAEventData['source']
type CTADialog = 'waitlist' | 'thank-you' | null

interface CTAContextValue {
  // Current active dialog
  activeDialog: CTADialog
  source: CTASource | null

  // Actions
  openWaitlist: (source: CTASource) => void
  showThankYou: () => void
  closeDialog: () => void
}

const CTAContext = createContext<CTAContextValue | null>(null)

export function CTAProvider({ children }: { children: ReactNode }) {
  const [activeDialog, setActiveDialog] = useState<CTADialog>(null)
  const [source, setSource] = useState<CTASource | null>(null)

  const openWaitlist = useCallback((ctaSource: CTASource) => {
    setSource(ctaSource)
    setActiveDialog('waitlist')
  }, [])

  const showThankYou = useCallback(() => {
    setActiveDialog('thank-you')
  }, [])

  const closeDialog = useCallback(() => {
    setActiveDialog(null)
  }, [])

  return (
    <CTAContext.Provider
      value={{
        activeDialog,
        source,
        openWaitlist,
        showThankYou,
        closeDialog,
      }}
    >
      {children}
    </CTAContext.Provider>
  )
}

export function useCTA() {
  const context = useContext(CTAContext)
  if (!context) {
    throw new Error('useCTA must be used within a CTAProvider')
  }
  return context
}
