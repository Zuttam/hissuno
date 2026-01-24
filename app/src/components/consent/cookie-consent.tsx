'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui'

export const CONSENT_KEY = 'hissuno_cookie_consent'

type ConsentStatus = 'pending' | 'accepted' | 'declined'

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentStatus>('pending')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored === 'accepted' || stored === 'declined') {
      setConsent(stored)
    }
    setIsLoaded(true)
  }, [])

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setConsent('accepted')
    // Reload to trigger instrumentation-client.ts initialization
    window.location.reload()
  }

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setConsent('declined')
  }

  return { consent, isLoaded, accept, decline }
}

export function CookieConsentBanner() {
  const { consent, isLoaded, accept, decline } = useCookieConsent()

  // Don't render until we've checked localStorage
  if (!isLoaded || consent !== 'pending') {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-subtle)] bg-[var(--background)]/95 p-4 backdrop-blur-sm md:p-6">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 md:flex-row">
        <p className="text-center text-sm text-[var(--text-secondary)] md:text-left">
          We use cookies to analyze site usage and improve your experience.{' '}
          <a
            href="/privacy"
            className="underline hover:text-[var(--foreground)]"
          >
            Learn more
          </a>
        </p>
        <div className="flex shrink-0 gap-3">
          <Button variant="secondary" size="sm" onClick={decline}>
            Decline
          </Button>
          <Button size="sm" onClick={accept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  )
}
