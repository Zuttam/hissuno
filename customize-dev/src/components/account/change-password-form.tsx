'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updatePasswordAction, type AuthActionState } from '@/lib/auth/actions'

const initialState: AuthActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-700"
      disabled={pending}
    >
      {pending ? 'Updating…' : 'Update password'}
    </button>
  )
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialState)

  return (
    <form className="space-y-4" action={formAction}>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="currentPassword">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="newPassword">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="confirmPassword">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>

      {state?.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  )
}
