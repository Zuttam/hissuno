'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updatePasswordAction, type AuthActionState } from '@/lib/auth/actions'
import { FormField, Input, Button, Heading } from '@/components/ui'

const initialState: AuthActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="primary" size="md" className="shrink-0" disabled={pending}>
      {pending ? 'Updating...' : 'Update Password'}
    </Button>
  )
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialState)

  return (
    <form className="flex flex-col gap-4" action={formAction}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Heading as="h2" size="section">Change Password</Heading>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Update your password to keep your account secure.
          </p>
        </div>
        <SubmitButton />
      </div>

      <FormField label="Current Password">
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>

      <FormField label="New Password">
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </FormField>

      <FormField label="Confirm New Password">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </FormField>

      {state?.error ? (
        <div className="rounded-[4px] border-2 border-[--accent-danger] bg-transparent px-3 py-2 text-sm font-mono text-[--foreground]">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="rounded-[4px] border-2 border-[--accent-success] bg-transparent px-3 py-2 text-sm font-mono text-[--foreground]">
          {state.success}
        </div>
      ) : null}
    </form>
  )
}
