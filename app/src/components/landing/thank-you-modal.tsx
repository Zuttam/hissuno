'use client'

import { useRouter } from 'next/navigation'
import { Dialog, Button } from '@/components/ui'
import { useCTA } from './cta-context'

export function ThankYouModal() {
  const router = useRouter()
  const { activeDialog, thankYouType, closeDialog } = useCTA()

  const isOpen = activeDialog === 'thank-you'

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
