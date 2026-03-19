import Link from 'next/link'
import { ThemeLogo } from '@/components/ui'
import { SignOutButton } from './sign-out-button'

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-100 via-white to-slate-200 px-4 py-16 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white/80 p-10 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60 dark:shadow-none">
        <header className="space-y-4 text-center">
          <div className="flex justify-center">
            <ThemeLogo width={300} height={100} priority />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
              Access Denied
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You don't have permission to access this page. Please sign in with an authorized account or contact your administrator.
            </p>
          </div>
        </header>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="flex w-full justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Sign In
          </Link>
          <SignOutButton signOutText="Back to Safety" />
        </div>
      </div>
    </main>
  )
}
