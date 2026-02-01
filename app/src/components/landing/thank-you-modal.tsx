'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Dialog, Button } from '@/components/ui'
import { useCTA } from './cta-context'

// Component that handles URL params - must be wrapped in Suspense
function CTAParamHandler() {
  const searchParams = useSearchParams()
  const { openWaitlist } = useCTA()

  // Auto-open when ?cta=<source> is in URL (e.g., ?cta=login from "Request access" link)
  useEffect(() => {
    const ctaSource = searchParams.get('cta')
    if (ctaSource) {
      openWaitlist(ctaSource as Parameters<typeof openWaitlist>[0])
    }
  }, [searchParams, openWaitlist])

  return null
}

export function ThankYouModal() {
  const { activeDialog, closeDialog } = useCTA()
  const hasTracked = useRef(false)

  const isThankYouOpen = activeDialog === 'thank-you'

  // Reset tracking when modal closes
  useEffect(() => {
    if (!isThankYouOpen) {
      hasTracked.current = false
    }
  }, [isThankYouOpen])

  const handleThankYouClose = () => {
    closeDialog()
  }

  return (
    <>
      <Suspense fallback={null}>
        <CTAParamHandler />
      </Suspense>

      <Dialog open={isThankYouOpen} onClose={handleThankYouClose} title="Thank You">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-teal)]/10">
            <svg
              className="h-6 w-6 text-[var(--accent-teal)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-[var(--foreground)]">You&apos;re on the list!</p>
            <p className="text-sm text-[var(--text-secondary)]">
              We&apos;ll reach out soon with early access. Looking forward to having you!
            </p>
          </div>
          <Button onClick={handleThankYouClose} variant="secondary" className="mt-4">
            Close
          </Button>
        </div>
      </Dialog>
    </>
  )
}
