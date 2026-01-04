import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmailIfNeeded } from '@/lib/email'
import { getSafeRedirectPath } from '@/lib/auth/server'

export const runtime = 'nodejs'

/**
 * OAuth callback handler for authentication providers.
 * This route handles the redirect from Supabase Auth after OAuth flow.
 *
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error('[auth.callback] OAuth error:', error, errorDescription)
    const errorUrl = new URL('/login', origin)
    errorUrl.searchParams.set('error', errorDescription || error)
    return NextResponse.redirect(errorUrl)
  }

  if (!code) {
    console.error('[auth.callback] No code provided')
    return NextResponse.redirect(new URL('/login', origin))
  }

  try {
    const supabase = await createClient()

    // Exchange the code for a session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[auth.callback] Failed to exchange code:', exchangeError)
      const errorUrl = new URL('/login', origin)
      errorUrl.searchParams.set('error', exchangeError.message)
      return NextResponse.redirect(errorUrl)
    }

    // Send welcome email for OAuth users (Google, etc.)
    const user = data?.user
    if (user) {
      const provider = user.app_metadata?.provider
      const isOAuthUser = provider && provider !== 'email'

      if (isOAuthUser && user.email) {
        const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name

        // Fire and forget - don't block redirect
        setImmediate(() => {
          sendWelcomeEmailIfNeeded(user.id, user.email!, fullName).catch((err) => {
            console.error('[auth.callback] Failed to send welcome email:', err)
          })
        })
      }
    }

    // Build redirect URL with validated path to prevent open redirect
    const safePath = getSafeRedirectPath(next)
    const redirectUrl = new URL(safePath, origin)

    // Preserve UTM params for attribution tracking
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
    for (const key of utmParams) {
      const value = searchParams.get(key)
      if (value) {
        redirectUrl.searchParams.set(key, value)
      }
    }

    // Check if this is a new user (created within last 60 seconds)
    if (user?.created_at) {
      const createdAt = new Date(user.created_at).getTime()
      const now = Date.now()
      const isNewUser = now - createdAt < 60000 // Created within last minute

      if (isNewUser) {
        redirectUrl.searchParams.set('signup_completed', 'true')
      }
    }

    return NextResponse.redirect(redirectUrl)
  } catch (err) {
    console.error('[auth.callback] Unexpected error:', err)
    return NextResponse.redirect(new URL('/login', origin))
  }
}
