'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { CTAEventData } from '@/lib/event_tracking/types'

type CTASource = CTAEventData['source']
type CTADialog = 'options' | 'waitlist' | 'thank-you' | null
type ThankYouType = 'waitlist' | 'call'

interface CTAContextValue {
  // Current active dialog
  activeDialog: CTADialog
  source: CTASource | null
  thankYouType: ThankYouType | null

  // Actions
  openCTAOptions: (source: CTASource) => void
  openWaitlistDialog: () => void
  showThankYou: (type: ThankYouType) => void
  closeDialog: () => void
}

const CTAContext = createContext<CTAContextValue | null>(null)

export function CTAProvider({ children }: { children: ReactNode }) {
  const [activeDialog, setActiveDialog] = useState<CTADialog>(null)
  const [source, setSource] = useState<CTASource | null>(null)
  const [thankYouType, setThankYouType] = useState<ThankYouType | null>(null)

  const openCTAOptions = useCallback((ctaSource: CTASource) => {
    setSource(ctaSource)
    setActiveDialog('options')
  }, [])

  const openWaitlistDialog = useCallback(() => {
    setActiveDialog('waitlist')
  }, [])

  const showThankYou = useCallback((type: ThankYouType) => {
    setThankYouType(type)
    setActiveDialog('thank-you')
  }, [])

  const closeDialog = useCallback(() => {
    setActiveDialog(null)
    // Reset thank you type after animation completes
    setTimeout(() => {
      setThankYouType(null)
    }, 300)
  }, [])

  return (
    <CTAContext.Provider
      value={{
        activeDialog,
        source,
        thankYouType,
        openCTAOptions,
        openWaitlistDialog,
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
