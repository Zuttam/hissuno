'use client'

import { signOutAction } from '@/lib/auth/actions'

type SignOutButtonProps = {
  signOutText?: string  
}

export function SignOutButton({ signOutText = 'Sign out' }: SignOutButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void signOutAction()}
      className="flex w-full justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50"
    >
      {signOutText}
    </button>
  )
}
