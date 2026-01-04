import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { storeGitHubToken } from '@/lib/integrations/github'
import { exchangeGitHubOAuthCode, getGitHubUser } from '@/lib/integrations/github/app-client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/github/callback
 * Handles GitHub OAuth callback
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin

  if (!isSupabaseConfigured()) {
    console.error('[integrations.github.callback] Supabase must be configured')
    return redirectWithError('Supabase must be configured.', origin)
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_SECRET
  const redirectUri = process.env.GITHUB_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('[integrations.github.callback] Missing GitHub OAuth configuration')
    return redirectWithError('GitHub integration not configured.', origin)
  }

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    // Handle user declining authorization
    if (error) {
      console.log('[integrations.github.callback] User declined:', error)
      return redirectWithError('GitHub authorization was declined.', origin)
    }

    if (!code || !state) {
      return redirectWithError('Missing authorization code or state.', origin)
    }

    // Decode and validate state
    let stateData: { projectId: string; userId: string; nonce: string; redirectUrl: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
    } catch {
      return redirectWithError('Invalid state parameter.', origin)
    }

    const { projectId, userId, redirectUrl } = stateData

    if (!projectId || !userId || !redirectUrl) {
      return redirectWithError('Invalid state data.', origin)
    }

    // Use admin client to verify the project belongs to the userId from state
    // Note: We trust the userId from state because it was created by the connect route
    // which verified the user's session. Session cookies don't work cross-domain (ngrok vs localhost).
    const adminSupabase = createAdminClient()
    const { data: project, error: projectError } = await adminSupabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return redirectWithError('Project not found.', origin)
    }

    if (project.user_id !== userId) {
      return redirectWithError('Project access denied.', origin)
    }

    // Exchange code for access token
    const tokenResponse = await exchangeGitHubOAuthCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })

    if (tokenResponse.error || !tokenResponse.access_token) {
      console.error('[integrations.github.callback] Token exchange failed:', tokenResponse.error)
      return redirectWithError('Failed to complete GitHub authorization.', origin)
    }

    // Get user info
    const githubUser = await getGitHubUser(tokenResponse.access_token)

    // Store the token (reuse admin client from above)
    const storeResult = await storeGitHubToken(adminSupabase, {
      projectId,
      accessToken: tokenResponse.access_token,
      accountLogin: githubUser.login,
      accountId: githubUser.id,
      installedByUserId: userId,
      installedByEmail: null, // Email not available without session
      scope: tokenResponse.scope || null,
    })

    if (!storeResult.success) {
      console.error('[integrations.github.callback] Failed to store token:', storeResult.error)
      return redirectWithError('Failed to save GitHub connection.', origin)
    }

    // Redirect back to the page specified in state
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('[integrations.github.callback] unexpected error', error)
    return redirectWithError('An unexpected error occurred.', origin)
  }
}

function redirectWithError(message: string, origin: string): NextResponse {
  const errorUrl = new URL('/projects', origin)
  errorUrl.searchParams.set('github_error', message)
  return NextResponse.redirect(errorUrl.toString())
}
