'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { loginAction, type AuthActionState } from '@/lib/auth/actions'
import { Alert, Button, FormField, Input, Divider } from '@/components/ui'
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

      <Divider className="my-4" />


      {/* Email/Password Form */}
      <form className="flex flex-col gap-4" action={formAction}>
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
      </form>
    </div>
  )
}
