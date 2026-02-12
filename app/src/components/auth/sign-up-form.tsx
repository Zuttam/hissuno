'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { signUpAction, type AuthActionState } from '@/lib/auth/actions'
import { GoogleSignInButton } from './google-sign-in-button'
import { trackSignupStarted, getStoredUTM } from '@/lib/event_tracking'
import { Divider } from '@/components/ui/divider'
import { storeInviteCode } from '@/lib/invites/session-storage'

const initialState: AuthActionState = {}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      className="mt-6 w-full rounded-[4px] border-2 border-[--accent-primary] bg-[--accent-primary] px-4 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-[--accent-primary-hover] hover:border-[--accent-primary-hover] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--accent-primary] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || pending}
    >
      {pending ? 'Creating account...' : 'Create account'}
    </button>
  )
}

interface SignUpFormProps {
  invite?: string
}

export function SignUpForm({ invite }: SignUpFormProps) {
  const [state, formAction] = useActionState(signUpAction, initialState)

  const [inviteCode, setInviteCode] = useState(invite ?? '')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [isValidatingInvite, setIsValidatingInvite] = useState(false)
  const [inviteValidated, setInviteValidated] = useState(false)

  // Validate invite code from URL on mount
  useEffect(() => {
    if (invite) {
      void validateInvite(invite)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const validateInvite = useCallback(async (code: string) => {
    if (!code.trim()) {
      setInviteError(null)
      setInviteValidated(false)
      return
    }

    setIsValidatingInvite(true)
    setInviteError(null)

    try {
      const response = await fetch(`/api/invites/validate?code=${encodeURIComponent(code.trim())}`)
      const result = await response.json()

      if (result.valid) {
        setInviteValidated(true)
        setInviteError(null)
      } else {
        setInviteValidated(false)
        setInviteError(result.error ?? 'Invalid invite code.')
      }
    } catch {
      setInviteError('Failed to validate invite code.')
      setInviteValidated(false)
    } finally {
      setIsValidatingInvite(false)
    }
  }, [])

  const handleInviteBlur = useCallback(() => {
    void validateInvite(inviteCode)
  }, [inviteCode, validateInvite])

  const handleGoogleClick = () => {
    trackSignupStarted({ method: 'google', utm: getStoredUTM() ?? undefined })
    // Store invite code for retrieval after OAuth callback
    if (inviteCode.trim()) {
      storeInviteCode(inviteCode.trim())
    }
  }

  const handleFormSubmit = () => {
    trackSignupStarted({ method: 'email', utm: getStoredUTM() ?? undefined })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Invite Code */}
      <div className="flex flex-col gap-2">
        <label className="block font-mono text-sm font-semibold uppercase tracking-wide text-[--foreground]" htmlFor="inviteCode">
          Invite Code
        </label>
        <div className="relative">
          <input
            id="inviteCode"
            name="inviteCode"
            type="text"
            value={inviteCode}
            onChange={(e) => {
              setInviteCode(e.target.value.toUpperCase())
              setInviteValidated(false)
              setInviteError(null)
            }}
            onBlur={handleInviteBlur}
            placeholder="ABCD1234"
            required
            maxLength={8}
            className={`w-full rounded-[4px] border-2 bg-[--background] px-3 py-2 font-mono text-sm uppercase text-[--foreground] outline-none transition focus:ring-0 ${
              inviteError
                ? 'border-[--accent-danger] focus:border-[--accent-danger]'
                : inviteValidated
                  ? 'border-[--accent-success] focus:border-[--accent-success]'
                  : 'border-[--border-subtle] focus:border-[--accent-primary]'
            }`}
          />
          {isValidatingInvite && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[--text-tertiary] border-t-transparent" />
            </div>
          )}
          {!isValidatingInvite && inviteValidated && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[--accent-success]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        {inviteError && (
          <p className="font-mono text-xs text-[--accent-danger]">{inviteError}</p>
        )}
        <p className={`font-mono text-xs ${inviteValidated ? 'text-[--accent-success]' : 'text-[--text-tertiary]'}`}>
          {inviteValidated
            ? 'You can now join the party \u{1F973}'
            : 'An invite code is required to sign up. Ask a friend for one!'}
        </p>
      </div>

      {/* Divider */}
      <Divider />

      {/* Google Sign-In */}
      <GoogleSignInButton redirectTo="/onboarding" onClick={handleGoogleClick} disabled={!inviteValidated} />

      {/* Or Divider */}
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-[--border-subtle]" />
        <span className="font-mono text-xs uppercase text-[--text-tertiary]">or</span>
        <div className="h-px flex-1 bg-[--border-subtle]" />
      </div>

      {/* Email/Password Form */}
      <form className="flex flex-col gap-4" action={formAction} onSubmit={handleFormSubmit}>
        <div className="flex flex-col gap-2">
          <label className="block font-mono text-sm font-semibold uppercase tracking-wide text-[--foreground]" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-[4px] border-2 border-[--border-subtle] bg-[--background] px-3 py-2 font-mono text-sm text-[--foreground] outline-none transition focus:border-[--accent-primary] focus:ring-0"
          />
        </div>

        {/* Hidden field to pass invite code to form action */}
        <input type="hidden" name="inviteCode" value={inviteCode} />

        <div className="space-y-1">
          <label className="block font-mono text-sm font-semibold uppercase tracking-wide text-[--foreground]" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-[4px] border-2 border-[--border-subtle] bg-[--background] px-3 py-2 font-mono text-sm text-[--foreground] outline-none transition focus:border-[--accent-primary] focus:ring-0"
          />
        </div>

        <div className="space-y-1">
          <label className="block font-mono text-sm font-semibold uppercase tracking-wide text-[--foreground]" htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-[4px] border-2 border-[--border-subtle] bg-[--background] px-3 py-2 font-mono text-sm text-[--foreground] outline-none transition focus:border-[--accent-primary] focus:ring-0"
          />
        </div>

        {state?.error && (
          <div className="rounded-[4px] border-2 border-[--accent-danger] bg-transparent px-3 py-2 font-mono text-sm text-[--accent-danger]">
            {state.error}
          </div>
        )}

        <SubmitButton disabled={!inviteValidated} />

        <p className="text-center text-sm text-[--text-secondary]">
          Already have an account?{' '}
          <Link className="font-semibold text-[--foreground] underline" href="/login">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
