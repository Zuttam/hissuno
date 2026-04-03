import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { encode } from '@auth/core/jwt'
import { auth } from '@/lib/auth/auth'
import { ThemeLogo } from '@/components/ui'
import { parseLocalhostPort } from '@/lib/utils/url'

interface CliCallbackPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function extractParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function CliCallbackPage({ searchParams }: CliCallbackPageProps) {
  const params = await (searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({}))
  const port = parseLocalhostPort(extractParam(params.port))
  const state = extractParam(params.state)

  if (!port || !state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-100 via-white to-slate-200 px-4 py-16 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/80 p-10 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60 dark:shadow-none">
          <div className="flex flex-col gap-4 text-center">
            <div className="flex justify-center">
              <ThemeLogo width={300} height={100} priority />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Invalid Request
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This page should be opened by the Hissuno CLI. Run <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">hissuno login</code> to authenticate.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const session = await auth()
  if (!session?.user?.id) {
    const loginUrl = `/login?redirectTo=${encodeURIComponent(`/auth/cli-callback?port=${String(port)}&state=${state}`)}`
    redirect(loginUrl)
  }

  // Determine salt based on protocol (matches AuthJS cookie name)
  const hdrs = await headers()
  const proto = hdrs.get('x-forwarded-proto') || 'http'
  const isSecure = proto === 'https'
  const salt = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'

  // Mint a JWT with the same format AuthJS uses
  const token = await encode({
    secret: process.env.AUTH_SECRET!,
    salt,
    token: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    maxAge: 30 * 24 * 60 * 60, // 30 days
  })

  const callbackUrl = new URL(`http://127.0.0.1:${port}/callback`)
  callbackUrl.searchParams.set('token', token)
  callbackUrl.searchParams.set('state', state)
  callbackUrl.searchParams.set('email', session.user.email ?? '')
  callbackUrl.searchParams.set('name', session.user.name ?? '')

  redirect(callbackUrl.toString())
}
