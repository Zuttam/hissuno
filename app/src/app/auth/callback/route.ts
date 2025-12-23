import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * OAuth callback handler for GitHub (and future providers).
 * This route handles the redirect from Supabase Auth after OAuth flow.
 * 
 * Key responsibility: Capture the provider_token from the session
 * and store it in user_github_tokens for later GitHub API access.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/projects'
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

    const { session, user } = data

    // Check if this was a GitHub OAuth flow by looking at provider_token
    // and user identities
    const githubIdentity = user?.identities?.find(
      (identity) => identity.provider === 'github'
    )

    if (session?.provider_token && githubIdentity) {
      // Store the GitHub access token for API access
      const githubUserMeta = githubIdentity.identity_data
      const githubUsername = githubUserMeta?.user_name || githubUserMeta?.preferred_username || null
      const githubUserId = githubIdentity.identity_id || githubUserMeta?.sub || null

      const { error: upsertError } = await supabase
        .from('user_github_tokens')
        .upsert(
          {
            user_id: user.id,
            access_token: session.provider_token,
            github_username: githubUsername,
            github_user_id: githubUserId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        )

      if (upsertError) {
        console.error('[auth.callback] Failed to store GitHub token:', upsertError)
        // Don't fail the auth flow, just log the error
        // The user can try reconnecting GitHub later
      } else {
        console.log('[auth.callback] GitHub token stored successfully for user:', user.id)
      }
    }

    // Redirect to the intended destination
    const redirectUrl = new URL(next, origin)
    return NextResponse.redirect(redirectUrl)
  } catch (err) {
    console.error('[auth.callback] Unexpected error:', err)
    return NextResponse.redirect(new URL('/login', origin))
  }
}
