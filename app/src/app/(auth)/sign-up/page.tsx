import { SignUpForm } from '@/components/auth/sign-up-form'
import { ThemeLogo } from '@/components/ui'

interface SignUpPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function extractParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const resolvedSearchParams =
    await (searchParams ??
      Promise.resolve<Record<string, string | string[] | undefined>>({}))
  const invite = extractParam(resolvedSearchParams?.invite)

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-100 via-white to-slate-200 px-4 py-16 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white/80 p-10 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60 dark:shadow-none">
        <header className="space-y-4 text-center">
          <div className="flex justify-center">
            <ThemeLogo width={300} height={100} priority />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
              Create Account
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign up with a valid invite code.
            </p>
          </div>
        </header>
        <SignUpForm invite={invite} />
      </div>
    </main>
  )
}
