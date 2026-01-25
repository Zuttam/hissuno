'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Dialog } from '@/components/ui'
import { useCTA } from './cta-context'
import { CalendlyPopup } from './calendly-popup'
import { trackCTAOptionsViewed, trackCTAOptionSelected } from '@/lib/event_tracking/events'

export function CTAOptionsDialog() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeDialog, source, openCTAOptions, openWaitlistDialog, showThankYou, closeDialog } = useCTA()
  const [isCalendlyOpen, setIsCalendlyOpen] = useState(false)

  const isOpen = activeDialog === 'options'

  // Auto-open when ?cta=<source> is in URL (e.g., ?cta=login from "Request access" link)
  useEffect(() => {
    const ctaSource = searchParams.get('cta') as typeof source
    if (ctaSource) {
      openCTAOptions(ctaSource)
    }
  }, [searchParams, openCTAOptions])

  // Track when modal opens
  useEffect(() => {
    if (isOpen && source) {
      trackCTAOptionsViewed({ source })
    }
  }, [isOpen, source])

  const handleBookCall = () => {
    if (source) {
      trackCTAOptionSelected({ source, option: 'book_call' })
    }
    setIsCalendlyOpen(true)
  }

  const handleJoinWaitlist = () => {
    if (source) {
      trackCTAOptionSelected({ source, option: 'join_waitlist' })
    }
    closeDialog()
    openWaitlistDialog()
  }

  const handleCalendlyClose = () => {
    setIsCalendlyOpen(false)
  }

  const handleBookingComplete = () => {
    setIsCalendlyOpen(false)
    closeDialog()
    showThankYou('call')
    router.push('/thank-you?type=call')
  }

  const handleClose = () => {
    closeDialog()
  }

  return (
    <>
      <Dialog open={isOpen} onClose={handleClose} title="Get Started" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Choose how you&apos;d like to get started with Hissuno.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Book a Call Option */}
            <button
              onClick={handleBookCall}
              className="group flex flex-col items-center gap-3 rounded-[4px] border-2 border-[var(--border-subtle)] bg-[var(--surface)] p-6 text-left transition hover:border-[var(--accent-teal)] hover:bg-[var(--surface-hover)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-teal)]/10 transition group-hover:bg-[var(--accent-teal)]/20">
                <svg
                  className="h-6 w-6 text-[var(--accent-teal)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="font-mono text-sm font-bold uppercase tracking-tight text-[var(--foreground)]">
                  Book a Call
                </h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  30-min intro call to discuss your needs
                </p>
              </div>
            </button>

            {/* Join Waitlist Option */}
            <button
              onClick={handleJoinWaitlist}
              className="group flex flex-col items-center gap-3 rounded-[4px] border-2 border-[var(--border-subtle)] bg-[var(--surface)] p-6 text-left transition hover:border-[var(--accent-selected)] hover:bg-[var(--surface-hover)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-selected)]/10 transition group-hover:bg-[var(--accent-selected)]/20">
                <svg
                  className="h-6 w-6 text-[var(--accent-selected)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="font-mono text-sm font-bold uppercase tracking-tight text-[var(--foreground)]">
                  Join Waitlist
                </h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Get notified when we launch
                </p>
              </div>
            </button>
          </div>
        </div>
      </Dialog>

      <CalendlyPopup
        isOpen={isCalendlyOpen}
        onClose={handleCalendlyClose}
        onBookingComplete={handleBookingComplete}
      />
    </>
  )
}
