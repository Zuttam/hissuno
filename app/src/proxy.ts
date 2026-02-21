import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { USER_EMAIL_HEADER, USER_ID_HEADER, USER_NAME_HEADER } from '@/lib/auth/server'
import {
  API_KEY_ID_HEADER,
  API_KEY_PROJECT_ID_HEADER,
  API_KEY_CREATED_BY_HEADER,
} from '@/lib/auth/identity'
import { resolveApiKey } from '@/lib/auth/api-keys'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_IDENTITY_HEADERS = [
  USER_ID_HEADER, USER_EMAIL_HEADER, USER_NAME_HEADER,
  API_KEY_ID_HEADER, API_KEY_PROJECT_ID_HEADER, API_KEY_CREATED_BY_HEADER,
] as const

function stripAllIdentityHeaders(requestHeaders: Headers, responseHeaders: Headers): void {
  for (const h of ALL_IDENTITY_HEADERS) {
    requestHeaders.delete(h)
    responseHeaders.delete(h)
  }
}

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * Verify a Bearer token against a static env var secret.
 * Returns:
 *   'ok'            – token matches
 *   'skip'          – env var not set and `optional` is true (dev no-op)
 *   'misconfigured' – env var not set and `optional` is false
 *   'unauthorized'  – missing/wrong token
 */
function verifyBearerAuth(
  request: NextRequest,
  envVar: string,
  optional: boolean,
): 'ok' | 'skip' | 'misconfigured' | 'unauthorized' {
  const secret = process.env[envVar]
  if (!secret) return optional ? 'skip' : 'misconfigured'
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return 'unauthorized'
  return authHeader.slice(7) === secret ? 'ok' : 'unauthorized'
}

function jsonResponse(body: object, status: number, supabaseResponse: NextResponse): NextResponse {
  const res = NextResponse.json(body, { status })
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...rest }) => res.cookies.set(name, value, rest))
  return res
}

function redirectResponse(url: URL, supabaseResponse: NextResponse): NextResponse {
  const res = NextResponse.redirect(url)
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...rest }) => res.cookies.set(name, value, rest))
  return res
}

// ---------------------------------------------------------------------------
// Path categorization
// ---------------------------------------------------------------------------

// Truly public — no auth at proxy level.
// Webhooks verify their own signatures; OAuth callbacks are part of auth flow.
const PUBLIC_PATHS = [
  '/login',
  '/sign-up',
  '/unauthorized',
  '/legal',
  '/landing',
  
  '/auth/callback',
  '/api/invites/validate',
  '/api/waitlist',
  
  '/api/integrations/github/callback',
  '/api/integrations/slack/callback',
  '/api/integrations/intercom/callback',
  '/api/integrations/widget',
  '/api/webhooks/lemon-squeezy',
  '/api/webhooks/slack',
  '/api/webhooks/jira',
  '/api/webhooks/linear',
  '/api/healthz',
]

// Bearer-token paths — proxy verifies static env var secret
const BEARER_AUTH_PATHS: Array<{ prefix: string; envVar: string; optional: boolean }> = [
  { prefix: '/api/admin', envVar: 'ADMIN_API_SECRET', optional: false },
  { prefix: '/api/cron', envVar: 'CRON_SECRET', optional: true },
]

// Paths that are public but should redirect authenticated users elsewhere
const MARKETING_PATHS = ['/']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((prefix) => matchesPathPrefix(pathname, prefix))
}

function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.includes(pathname)
}

function findBearerAuthPath(pathname: string) {
  return BEARER_AUTH_PATHS.find((entry) => matchesPathPrefix(pathname, entry.prefix))
}

// ---------------------------------------------------------------------------
// Main proxy
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  let supabaseResponse: NextResponse | undefined

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse!.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!supabaseResponse) {
    supabaseResponse = NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  // Fetch user profile for name, activation, and onboarding status
  let userProfile: { full_name: string | null; is_activated: boolean; onboarding_completed: boolean } | null = null

  if (user?.id) {
    requestHeaders.set(USER_ID_HEADER, user.id)
    supabaseResponse.headers.set(USER_ID_HEADER, user.id)

    if (user.email) {
      requestHeaders.set(USER_EMAIL_HEADER, user.email)
      supabaseResponse.headers.set(USER_EMAIL_HEADER, user.email)
    } else {
      requestHeaders.delete(USER_EMAIL_HEADER)
      supabaseResponse.headers.delete(USER_EMAIL_HEADER)
    }

    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, is_activated, onboarding_completed')
      .eq('user_id', user.id)
      .single()
    userProfile = data

    const userName = userProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || null
    if (userName) {
      requestHeaders.set(USER_NAME_HEADER, userName)
      supabaseResponse.headers.set(USER_NAME_HEADER, userName)
    } else {
      requestHeaders.delete(USER_NAME_HEADER)
      supabaseResponse.headers.delete(USER_NAME_HEADER)
    }
  } else {
    // SECURITY: Strip all identity headers when no JWT session exists.
    stripAllIdentityHeaders(requestHeaders, supabaseResponse.headers)
  }

  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api')

  // -------------------------------------------------------------------
  // 1. Bearer-auth paths (admin, cron) — checked first, no ambiguity
  // -------------------------------------------------------------------
  const bearerEntry = findBearerAuthPath(pathname)
  if (bearerEntry) {
    const result = verifyBearerAuth(request, bearerEntry.envVar, bearerEntry.optional)
    switch (result) {
      case 'misconfigured':
        return jsonResponse(
          { error: `${bearerEntry.envVar} environment variable is not configured.` },
          500,
          supabaseResponse,
        )
      case 'unauthorized':
        return jsonResponse({ error: 'Unauthorized.' }, 401, supabaseResponse)
      case 'ok':
      case 'skip':
        // Strip identity headers — admin/cron use createAdminClient(), not user context
        stripAllIdentityHeaders(requestHeaders, supabaseResponse.headers)
        return NextResponse.next({ request: { headers: requestHeaders } })
    }
  }

  // -------------------------------------------------------------------
  // 2. Public paths — pass through (with marketing redirect logic)
  // -------------------------------------------------------------------
  if (isPublicPath(pathname) || isMarketingPath(pathname)) {
    // Redirect authenticated users from marketing pages to /projects
    if (user && isMarketingPath(pathname)) {
      return redirectResponse(new URL('/projects', request.url), supabaseResponse)
    }

    // Handle OAuth errors on root URL — redirect to /login with error params
    if (!user && isMarketingPath(pathname)) {
      const errorParam = request.nextUrl.searchParams.get('error')
      const errorDescription = request.nextUrl.searchParams.get('error_description')
      const errorCode = request.nextUrl.searchParams.get('error_code')

      if (errorParam || errorDescription || errorCode) {
        const loginUrl = new URL('/login', request.url)
        if (errorParam) loginUrl.searchParams.set('error', errorParam)
        if (errorDescription) loginUrl.searchParams.set('error_description', errorDescription)
        if (errorCode) loginUrl.searchParams.set('error_code', errorCode)
        return redirectResponse(loginUrl, supabaseResponse)
      }
    }

    return supabaseResponse
  }

  // -------------------------------------------------------------------
  // 3. Protected paths — require authentication
  // -------------------------------------------------------------------
  if (!user) {
    if (isApiRoute) {
      // Check for API key authentication (Bearer hiss_*)
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer hiss_')) {
        const resolved = await resolveApiKey(authHeader.slice(7))
        if (!resolved) {
          return jsonResponse({ error: 'Invalid API key' }, 401, supabaseResponse)
        }

        // SECURITY: Strip all identity headers before injecting API key identity
        stripAllIdentityHeaders(requestHeaders, supabaseResponse.headers)

        // Inject API key identity headers
        requestHeaders.set(API_KEY_ID_HEADER, resolved.keyId)
        requestHeaders.set(API_KEY_PROJECT_ID_HEADER, resolved.projectId)
        requestHeaders.set(API_KEY_CREATED_BY_HEADER, resolved.createdByUserId)

        // Project-scoped route guard: verify project ID matches
        const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)/)
        if (projectMatch && projectMatch[1] !== resolved.projectId) {
          return jsonResponse({ error: 'Forbidden' }, 403, supabaseResponse)
        }

        return NextResponse.next({ request: { headers: requestHeaders } })
      }

      return jsonResponse({ error: 'Unauthorized' }, 401, supabaseResponse)
    }

    // Page route — redirect to login
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/login') {
      loginUrl.searchParams.set('redirectTo', `${pathname}${request.nextUrl.search}`)
    }
    return redirectResponse(loginUrl, supabaseResponse)
  }

  // -------------------------------------------------------------------
  // 4. Authenticated page routes — check activation/onboarding
  // -------------------------------------------------------------------
  if (!isApiRoute) {
    const isOnboardingPath = pathname === '/onboarding' || pathname.startsWith('/onboarding/')

    if (!userProfile || !userProfile.is_activated) {
      return redirectResponse(new URL('/unauthorized', request.url), supabaseResponse)
    }

    if (!isOnboardingPath && !userProfile.onboarding_completed && !pathname.startsWith('/logout')) {
      return redirectResponse(new URL('/onboarding', request.url), supabaseResponse)
    }
  }

  // -------------------------------------------------------------------
  // 5. Default — pass through
  // -------------------------------------------------------------------
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
