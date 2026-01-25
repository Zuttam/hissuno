'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, Button } from '@/components/ui'
import { useCTA } from './cta-context'
import { trackWaitlistCompleted } from '@/lib/event_tracking/events'

// Strict email regex (RFC 5322 simplified)
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export function WaitlistDialog() {
  const router = useRouter()
  const { activeDialog, showThankYou, closeDialog } = useCTA()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSubmitTime, setLastSubmitTime] = useState(0)

  const isOpen = activeDialog === 'waitlist'

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    // Client-side rate limiting - 3 second cooldown
    const now = Date.now()
    if (now - lastSubmitTime < 3000) {
      setError('Please wait a moment before trying again.')
      return
    }

    const trimmedEmail = email.trim().toLowerCase()

    // Validate email format
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    // Validate email length
    if (trimmedEmail.length > 254) {
      setError('Email address is too long.')
      return
    }

    setIsLoading(true)
    setLastSubmitTime(now)

    try {
      // Get honeypot field value
      const form = e.currentTarget
      const honeypotField = form.elements.namedItem('website') as HTMLInputElement
      const honeypotValue = honeypotField?.value || ''

      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          website: honeypotValue, // honeypot field
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to join waitlist.')
      }

      // Success - track conversion BEFORE navigation
      trackWaitlistCompleted({})
      setEmail('')
      closeDialog()
      showThankYou('waitlist')
      router.push('/thank-you?type=waitlist')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    closeDialog()
    // Reset state after animation
    setTimeout(() => {
      setEmail('')
      setError(null)
    }, 300)
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} title="Join the Waitlist">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Be the first to know when Hissuno launches. Enter your email below.
        </p>

        <div className="space-y-2">
          <label htmlFor="waitlist-email" className="sr-only">
            Email address
          </label>
          <input
            id="waitlist-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
            disabled={isLoading}
            className="w-full rounded-[4px] border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent-teal)] focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Honeypot field - hidden from real users, attracts bots */}
        <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
          <label htmlFor="waitlist-website">Website</label>
          <input
            id="waitlist-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--accent-danger)]" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          loading={isLoading}
          disabled={isLoading}
          className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
        >
          Join the Waitlist
        </Button>
      </form>
    </Dialog>
  )
}
