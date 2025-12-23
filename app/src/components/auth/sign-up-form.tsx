'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { signUpAction, type AuthActionState } from '@/lib/auth/actions'
import { GoogleSignInButton } from './google-sign-in-button'

const initialState: AuthActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      className="mt-6 w-full rounded-[4px] border-2 border-[--accent-primary] bg-[--accent-primary] px-4 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-[--accent-primary-hover] hover:border-[--accent-primary-hover] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--accent-primary] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
    >
      {pending ? 'Creating account...' : 'Create account'}
    </button>
  )
}

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialState)

  return (
    <div className="space-y-6">
      {/* Google Sign-In */}
      <GoogleSignInButton redirectTo="/projects" />

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[--border-subtle]" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-[--background] px-4 font-mono uppercase tracking-wide text-[--text-secondary]">
            or
          </span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form className="space-y-4" action={formAction}>
        <div className="space-y-1">
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
          <div className="rounded-[4px] border-2 border-[--accent-danger] bg-transparent px-3 py-2 font-mono text-sm text-[--foreground]">
            {state.error}
          </div>
        )}

        <SubmitButton />

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
