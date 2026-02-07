'use client'

import { useState, useCallback, FormEvent } from 'react'
import { Dialog, Button, Input } from '@/components/ui'
import { useCTA } from './cta-context'
import { trackWaitlistCompleted } from '@/lib/event_tracking/events'

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export function WaitlistDialog() {
  const { activeDialog, source, closeDialog, showThankYou } = useCTA()
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // Honeypot field
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOpen = activeDialog === 'waitlist'

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError(null)

      // Client-side email validation
      const trimmedEmail = email.trim()
      if (!trimmedEmail) {
        setError('Email is required.')
        return
      }
      if (!EMAIL_REGEX.test(trimmedEmail)) {
        setError('Please enter a valid email address.')
        return
      }

      setIsSubmitting(true)

      try {
        const response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, website, source }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to join waitlist.')
          return
        }

        // Track waitlist completion on success
        trackWaitlistCompleted({ email: trimmedEmail })

        // Success - close waitlist dialog and show thank you modal
        closeDialog()
        setEmail('')
        showThankYou()
      } catch {
        setError('Something went wrong. Please try again.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [email, website, source, closeDialog, showThankYou]
  )

  const handleClose = useCallback(() => {
    setError(null)
    setEmail('')
    closeDialog()
  }, [closeDialog])

  return (
    <Dialog open={isOpen} onClose={handleClose} title="Join the Beta">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Thanks for your interest in Hissuno!<br /> We&apos;re gradually onboarding new users and will send you an invite when it&apos;s your turn to blast off. 🚀⚡
        </p>

        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          disabled={isSubmitting}
        />

        {/* Honeypot field - hidden from users, bots will fill it */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        {error && (
          <p className="text-sm text-[var(--accent-danger)]">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !email}
            className="bg-[var(--accent-selected)] hover:opacity-90"
          >
            {isSubmitting ? 'Joining...' : 'Join the Beta'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
