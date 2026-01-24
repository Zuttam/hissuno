'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, Button } from '@/components/ui'
import { useCTA } from './cta-context'
import { trackThankYouPageViewed } from '@/lib/event_tracking/events'
import { getStoredUTM } from '@/lib/event_tracking/utm'

export function ThankYouModal() {
  const router = useRouter()
  const { activeDialog, thankYouType, source, closeDialog } = useCTA()
  const hasTracked = useRef(false)

  const isOpen = activeDialog === 'thank-you'

  // Track thank you page view when modal opens
  useEffect(() => {
    if (isOpen && thankYouType && !hasTracked.current) {
      hasTracked.current = true
      trackThankYouPageViewed({
        type: thankYouType,
        source: source ?? undefined,
        utm: getStoredUTM() ?? undefined,
      })
    }

    // Reset tracking flag when modal closes
    if (!isOpen) {
      hasTracked.current = false
    }
  }, [isOpen, thankYouType, source])

  const handleClose = () => {
    closeDialog()
    router.push('/')
  }

  const content = thankYouType === 'call' ? {
    title: 'Your call is booked!',
    message: "We'll send you a calendar invite shortly. Looking forward to chatting!",
  } : {
    title: "You're on the list!",
    message: "We'll notify you when Hissuno is ready for you.",
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} title="Thank You">
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
          <p className="text-lg font-medium text-[var(--foreground)]">{content.title}</p>
          <p className="text-sm text-[var(--text-secondary)]">{content.message}</p>
        </div>
        <Button onClick={handleClose} variant="secondary" className="mt-4">
          Close
        </Button>
      </div>
    </Dialog>
  )
}
