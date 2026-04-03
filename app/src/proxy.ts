import crypto from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { USER_EMAIL_HEADER, USER_ID_HEADER, USER_NAME_HEADER } from '@/lib/auth/server'
import {
  API_KEY_ID_HEADER,
  API_KEY_PROJECT_ID_HEADER,
  API_KEY_CREATED_BY_HEADER,
} from '@/lib/auth/identity'
import { resolveApiKey } from '@/lib/auth/api-keys'
import { getToken } from 'next-auth/jwt'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_IDENTITY_HEADERS = [
  USER_ID_HEADER, USER_EMAIL_HEADER, USER_NAME_HEADER,
  API_KEY_ID_HEADER, API_KEY_PROJECT_ID_HEADER, API_KEY_CREATED_BY_HEADER,
] as const

function stripAllIdentityHeaders(requestHeaders: Headers): void {
  for (const h of ALL_IDENTITY_HEADERS) {
    requestHeaders.delete(h)
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
  const token = authHeader.slice(7)
  const tokenBuf = Buffer.from(token)
  const secretBuf = Buffer.from(secret)
  if (tokenBuf.length !== secretBuf.length) return 'unauthorized'
  return crypto.timingSafeEqual(tokenBuf, secretBuf) ? 'ok' : 'unauthorized'
}

function jsonResponse(body: object, status: number): NextResponse {
  return NextResponse.json(body, { status })
}

function redirectResponse(url: URL): NextResponse {
  return NextResponse.redirect(url)
}

// ---------------------------------------------------------------------------
// Path categorization
// ---------------------------------------------------------------------------

// Truly public — no auth at proxy level.
// Webhooks verify their own signatures; OAuth callbacks are part of auth flow.
const PUBLIC_PATHS = [
  '/login',
  '/unauthorized',
  '/legal',
  '/landing',
  '/docs',
  '/faq',
  
  '/auth/callback',
  '/api/auth',

  '/api/integrations/github/callback',
  '/api/integrations/slack/callback',
  '/api/integrations/intercom/callback',
  '/api/integrations/linear/callback',
  '/api/integrations/hubspot/callback',
  '/api/integrations/notion/callback',
  '/api/integrations/widget/embed',
  '/api/integrations/widget/chat',
  '/api/webhooks/slack',
  '/api/webhooks/jira',
  '/api/webhooks/linear',
  '/api/healthz',
]

// Bearer-token paths — proxy verifies static env var secret
const BEARER_AUTH_PATHS: Array<{ prefix: string; envVar: string; optional: boolean }> = [
  { prefix: '/api/cron', envVar: 'CRON_SECRET', optional: false },
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

  const pathname = request.nextUrl.pathname

  // Let AuthJS handle its own routes without any proxy interference.
  // Calling auth() here would consume PKCE/state cookies and break the OAuth flow.
  if (matchesPathPrefix(pathname, '/api/auth')) {
    stripAllIdentityHeaders(requestHeaders)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const isApiRoute = pathname.startsWith('/api')

  // -------------------------------------------------------------------
  // 1. Bearer-auth paths (admin, cron) — checked first, no auth() needed
  // -------------------------------------------------------------------
  const bearerEntry = findBearerAuthPath(pathname)
  if (bearerEntry) {
    const result = verifyBearerAuth(request, bearerEntry.envVar, bearerEntry.optional)
    switch (result) {
      case 'misconfigured':
        return jsonResponse(
          { error: `${bearerEntry.envVar} environment variable is not configured.` },
          500,
        )
      case 'unauthorized':
        return jsonResponse({ error: 'Unauthorized.' }, 401)
      case 'ok':
      case 'skip':
        // Strip identity headers — admin/cron use db directly, not user context
        stripAllIdentityHeaders(requestHeaders)
        return NextResponse.next({ request: { headers: requestHeaders } })
    }
  }

  // -------------------------------------------------------------------
  // 2. Public paths that don't need session resolution
  // -------------------------------------------------------------------
  if (isPublicPath(pathname)) {
    stripAllIdentityHeaders(requestHeaders)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // -------------------------------------------------------------------
  // 3. Resolve user identity (cookie session OR Bearer JWT)
  //    getToken() handles both: reads cookie first, falls back to
  //    Authorization: Bearer header. This covers browser sessions
  //    and CLI login tokens in a single call.
  // -------------------------------------------------------------------
  let userId: string | null = null
  try {
    const jwt = await getToken({ req: request, secret: process.env.AUTH_SECRET! })
    if (jwt?.id) {
      userId = jwt.id as string
      stripAllIdentityHeaders(requestHeaders)
      requestHeaders.set(USER_ID_HEADER, userId)

      if (jwt.email) {
        requestHeaders.set(USER_EMAIL_HEADER, jwt.email as string)
      }

      const [profile] = await db
        .select({ full_name: userProfiles.full_name })
        .from(userProfiles)
        .where(eq(userProfiles.user_id, userId))
        .limit(1)

      const userName = profile?.full_name || (jwt.name as string) || null
      if (userName) {
        requestHeaders.set(USER_NAME_HEADER, userName)
      }
    } else {
      stripAllIdentityHeaders(requestHeaders)
    }
  } catch (err) {
    console.error('[proxy] getToken() failed', err)
    stripAllIdentityHeaders(requestHeaders)
    if (isApiRoute) return jsonResponse({ error: 'Unauthorized' }, 401)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', `${pathname}${request.nextUrl.search}`)
    loginUrl.searchParams.set('error', 'Your session has expired. Please sign in again.')
    return redirectResponse(loginUrl)
  }

  // -------------------------------------------------------------------
  // 4. Marketing paths — redirect authenticated users
  // -------------------------------------------------------------------
  if (isMarketingPath(pathname)) {
    if (userId) {
      return redirectResponse(new URL('/projects', request.url))
    }

    // Handle OAuth errors on root URL — redirect to /login with error params
    const errorParam = request.nextUrl.searchParams.get('error')
    const errorDescription = request.nextUrl.searchParams.get('error_description')
    const errorCode = request.nextUrl.searchParams.get('error_code')

    if (errorParam || errorDescription || errorCode) {
      const loginUrl = new URL('/login', request.url)
      if (errorParam) loginUrl.searchParams.set('error', errorParam)
      if (errorDescription) loginUrl.searchParams.set('error_description', errorDescription)
      if (errorCode) loginUrl.searchParams.set('error_code', errorCode)
      return redirectResponse(loginUrl)
    }

    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // -------------------------------------------------------------------
  // 5. Protected paths — require authentication
  // -------------------------------------------------------------------
  if (!userId) {
    if (isApiRoute) {
      // Check for API key authentication (Bearer hiss_*)
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer hiss_')) {
        const resolved = await resolveApiKey(authHeader.slice(7))
        if (!resolved) {
          return jsonResponse({ error: 'Invalid API key' }, 401)
        }

        // SECURITY: Strip all identity headers before injecting API key identity
        stripAllIdentityHeaders(requestHeaders)

        // Inject API key identity headers
        requestHeaders.set(API_KEY_ID_HEADER, resolved.keyId)
        requestHeaders.set(API_KEY_PROJECT_ID_HEADER, resolved.projectId)
        requestHeaders.set(API_KEY_CREATED_BY_HEADER, resolved.createdByUserId)

        // Project-scoped route guard: verify project ID matches
        const projectIdParam = request.nextUrl.searchParams.get('projectId')
        if (projectIdParam && projectIdParam !== resolved.projectId) {
          return jsonResponse({ error: 'Forbidden' }, 403)
        }
        const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)/)
        if (projectMatch && projectMatch[1] !== resolved.projectId) {
          return jsonResponse({ error: 'Forbidden' }, 403)
        }

        return NextResponse.next({ request: { headers: requestHeaders } })
      }

      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // Page route — redirect to login
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/login') {
      loginUrl.searchParams.set('redirectTo', `${pathname}${request.nextUrl.search}`)
    }
    return redirectResponse(loginUrl)
  }

  // -------------------------------------------------------------------
  // 6. Default — pass through with finalized headers
  // -------------------------------------------------------------------
  return NextResponse.next({ request: { headers: requestHeaders } })
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
