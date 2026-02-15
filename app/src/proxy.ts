import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { USER_EMAIL_HEADER, USER_ID_HEADER, USER_NAME_HEADER } from '@/lib/auth/server'
import {
  API_KEY_ID_HEADER,
  API_KEY_PROJECT_ID_HEADER,
  API_KEY_CREATED_BY_HEADER,
} from '@/lib/auth/identity'
import { resolveApiKey } from '@/lib/auth/api-keys'

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/sign-up',
  '/unauthorized',

  '/legal',
  '/landing',


  '/auth/callback',
  '/api/cron',
  '/api/invites/validate',
  '/api/integrations/github/callback',
  '/api/integrations/slack/callback',
  '/api/integrations/widget',
  '/api/waitlist',

  '/api/webhooks/lemon-squeezy',
  '/api/webhooks/slack',
  '/api/admin',
]

// Paths that are public but should redirect authenticated users elsewhere
const MARKETING_PATHS = ['/']

function isPublicPath(pathname: string) {
  if (MARKETING_PATHS.includes(pathname)) {
    return true
  }
  return PUBLIC_PATH_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isMarketingPath(pathname: string) {
  return MARKETING_PATHS.includes(pathname)
}

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
            request: {
              headers: requestHeaders,
            },
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
      request: {
        headers: requestHeaders,
      },
    })
  }

  // Fetch user profile for name, activation, and onboarding status (used in multiple places below)
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
    // This prevents client-supplied headers from being trusted.
    requestHeaders.delete(USER_ID_HEADER)
    requestHeaders.delete(USER_EMAIL_HEADER)
    requestHeaders.delete(USER_NAME_HEADER)
    requestHeaders.delete(API_KEY_ID_HEADER)
    requestHeaders.delete(API_KEY_PROJECT_ID_HEADER)
    requestHeaders.delete(API_KEY_CREATED_BY_HEADER)
    supabaseResponse.headers.delete(USER_ID_HEADER)
    supabaseResponse.headers.delete(USER_EMAIL_HEADER)
    supabaseResponse.headers.delete(USER_NAME_HEADER)
    supabaseResponse.headers.delete(API_KEY_ID_HEADER)
    supabaseResponse.headers.delete(API_KEY_PROJECT_ID_HEADER)
    supabaseResponse.headers.delete(API_KEY_CREATED_BY_HEADER)
  }

  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api')
  const requiresAuth = !isPublicPath(pathname)

  const forwardCookies = (target: NextResponse) => {
    supabaseResponse!.cookies.getAll().forEach(({ name, value, ...rest }) => {
      target.cookies.set(name, value, rest)
    })
  }

  if (!user && requiresAuth) {
    if (isApiRoute) {
      // Check for API key authentication (Bearer hiss_*)
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer hiss_')) {
        const resolved = await resolveApiKey(authHeader.slice(7))
        if (!resolved) {
          const invalidKey = NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
          forwardCookies(invalidKey)
          return invalidKey
        }

        // SECURITY: Defensive re-strip of all identity headers (C4 fix)
        // The block above already stripped them, but we re-strip here to
        // document the invariant that no client-supplied identity headers
        // survive past this point.
        requestHeaders.delete(USER_ID_HEADER)
        requestHeaders.delete(USER_EMAIL_HEADER)
        requestHeaders.delete(USER_NAME_HEADER)
        requestHeaders.delete(API_KEY_ID_HEADER)
        requestHeaders.delete(API_KEY_PROJECT_ID_HEADER)
        requestHeaders.delete(API_KEY_CREATED_BY_HEADER)

        // Inject API key identity headers
        requestHeaders.set(API_KEY_ID_HEADER, resolved.keyId)
        requestHeaders.set(API_KEY_PROJECT_ID_HEADER, resolved.projectId)
        requestHeaders.set(API_KEY_CREATED_BY_HEADER, resolved.createdByUserId)

        // Project-scoped route guard: verify project ID matches
        const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)/)
        if (projectMatch && projectMatch[1] !== resolved.projectId) {
          const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 })
          forwardCookies(forbidden)
          return forbidden
        }

        // Let request through to route handler
        return NextResponse.next({ request: { headers: requestHeaders } })
      }

      const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      forwardCookies(unauthorized)
      return unauthorized
    }

    const redirectUrl = new URL('/login', request.url)

    if (pathname !== '/login') {
      const redirectTarget = `${pathname}${request.nextUrl.search}`
      redirectUrl.searchParams.set('redirectTo', redirectTarget)
    }

    const redirectResponse = NextResponse.redirect(redirectUrl)
    forwardCookies(redirectResponse)
    return redirectResponse
  }

  // Redirect authenticated users from marketing pages to projects
  if (user && isMarketingPath(pathname)) {
    const analyticsUrl = new URL('/projects', request.url)
    const redirectResponse = NextResponse.redirect(analyticsUrl)
    forwardCookies(redirectResponse)
    return redirectResponse
  }

  // Handle OAuth errors on root URL (Supabase may redirect here with error params)
  // Redirect to login page with error params preserved
  if (!user && isMarketingPath(pathname)) {
    const errorParam = request.nextUrl.searchParams.get('error')
    const errorDescription = request.nextUrl.searchParams.get('error_description')
    const errorCode = request.nextUrl.searchParams.get('error_code')

    if (errorParam || errorDescription || errorCode) {
      const loginUrl = new URL('/login', request.url)
      if (errorParam) loginUrl.searchParams.set('error', errorParam)
      if (errorDescription) loginUrl.searchParams.set('error_description', errorDescription)
      if (errorCode) loginUrl.searchParams.set('error_code', errorCode)

      const redirectResponse = NextResponse.redirect(loginUrl)
      forwardCookies(redirectResponse)
      return redirectResponse
    }
  }

  // Check if authenticated user is activated and has completed onboarding
  // Non-activated users go to /unauthorized; activated but non-onboarded users go to /onboarding
  const isOnboardingPath = pathname === '/onboarding' || pathname.startsWith('/onboarding/')
  if (user && !isPublicPath(pathname) && !isApiRoute) {
    // Non-activated users always go to /unauthorized
    if (!userProfile || !userProfile.is_activated) {
      const unauthorizedUrl = new URL('/unauthorized', request.url)
      const redirectResponse = NextResponse.redirect(unauthorizedUrl)
      forwardCookies(redirectResponse)
      return redirectResponse
    }

    // Activated but non-onboarded users go to /onboarding (skip if already there)
    if (!isOnboardingPath && !userProfile.onboarding_completed) {
      const onboardingUrl = new URL('/onboarding', request.url)
      const redirectResponse = NextResponse.redirect(onboardingUrl)
      forwardCookies(redirectResponse)
      return redirectResponse
    }
  }

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
