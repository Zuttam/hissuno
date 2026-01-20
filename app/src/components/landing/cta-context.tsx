'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { CTAEventData } from '@/lib/analytics/types'

type CTASource = CTAEventData['source']

interface CTAContextValue {
  isOptionsOpen: boolean
  source: CTASource | null
  openCTAOptions: (source: CTASource) => void
  closeCTAOptions: () => void
}

const CTAContext = createContext<CTAContextValue | null>(null)

export function CTAProvider({ children }: { children: ReactNode }) {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false)
  const [source, setSource] = useState<CTASource | null>(null)

  const openCTAOptions = useCallback((ctaSource: CTASource) => {
    setSource(ctaSource)
    setIsOptionsOpen(true)
  }, [])

  const closeCTAOptions = useCallback(() => {
    setIsOptionsOpen(false)
  }, [])

  return (
    <CTAContext.Provider value={{ isOptionsOpen, source, openCTAOptions, closeCTAOptions }}>
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
