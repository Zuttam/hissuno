import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { USER_EMAIL_HEADER, USER_ID_HEADER } from '@/lib/auth/server'

const PUBLIC_PATH_PREFIXES = ['/login', '/sign-up', '/auth/callback', '/api/auth']

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function updateSession(request: NextRequest) {
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
  } else {
    requestHeaders.delete(USER_ID_HEADER)
    requestHeaders.delete(USER_EMAIL_HEADER)
    supabaseResponse.headers.delete(USER_ID_HEADER)
    supabaseResponse.headers.delete(USER_EMAIL_HEADER)
  }

  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api')
  const requiresAuth = !isPublicPath(pathname)

  if (!user && requiresAuth) {
    const forwardCookies = (target: NextResponse) => {
      supabaseResponse!.cookies.getAll().forEach(({ name, value, ...rest }) => {
        target.cookies.set(name, value, rest)
      })
    }

    if (isApiRoute) {
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

  return supabaseResponse
}
