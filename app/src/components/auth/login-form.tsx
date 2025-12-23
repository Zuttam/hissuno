'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { loginAction, type AuthActionState } from '@/lib/auth/actions'
import { Alert, Button, FormField, Input } from '@/components/ui'
import { GoogleSignInButton } from './google-sign-in-button'

const initialState: AuthActionState = {}

interface LoginFormProps {
  redirectTo: string
  message?: string
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="lg" loading={pending} className="mt-6 w-full">
      {pending ? 'Signing in...' : 'Sign in'}
    </Button>
  )
}

export function LoginForm({ redirectTo, message }: LoginFormProps) {
  const [state, formAction] = useActionState(loginAction, initialState)

  return (
    <div className="space-y-6">
      {/* Google Sign-In */}
      <GoogleSignInButton redirectTo={redirectTo} />

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
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <FormField label="Email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </FormField>

        <FormField label="Password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </FormField>

        {(state?.error || message) && (
          <Alert variant="warning">{state?.error ?? message}</Alert>
        )}

        <SubmitButton />

        <p className="text-center text-sm text-[--text-secondary]">
          Need an account?{' '}
          <Link className="font-semibold text-[--foreground] underline" href="/sign-up">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  )
}
