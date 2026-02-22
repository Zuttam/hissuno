import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { LinearClient } from '@linear/sdk'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getSafeRedirectPath } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { exchangeCodeForTokens } from '@/lib/integrations/linear/oauth'
import { storeLinearConnection } from '@/lib/integrations/linear'
import type { LinearOAuthState } from '@/types/linear'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/linear/callback
 * Handles Linear OAuth callback after user authorizes
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return redirectWithError('Supabase must be configured.')
  }

  const clientId = process.env.LINEAR_CLIENT_ID
  const clientSecret = process.env.LINEAR_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/linear/callback`

  if (!clientId || !clientSecret) {
    return redirectWithError('Linear integration not configured.')
  }

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    // Handle user declining authorization
    if (error) {
      console.log('[integrations.linear.callback] User declined:', error)
      return redirectWithError('Linear authorization was declined.')
    }

    if (!code || !state) {
      return redirectWithError('Missing authorization code or state.')
    }

    // Verify HMAC signature and decode state
    const [statePayload, stateSignature] = state.split('.')
    if (!statePayload || !stateSignature) {
      return redirectWithError('Invalid state parameter.')
    }

    const expectedSig = crypto.createHmac('sha256', clientSecret).update(statePayload).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(stateSignature), Buffer.from(expectedSig))) {
      return redirectWithError('Invalid state signature.')
    }

    let stateData: LinearOAuthState
    try {
      stateData = JSON.parse(Buffer.from(statePayload, 'base64url').toString('utf-8'))
    } catch {
      return redirectWithError('Invalid state parameter.')
    }

    const { projectId, userId, redirectUrl } = stateData

    if (!projectId || !userId) {
      return redirectWithError('Invalid state data.')
    }

    // Verify project ownership using admin client
    const adminSupabase = createAdminClient()
    const { data: project, error: projectError } = await adminSupabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return redirectWithError('Project not found.')
    }

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      return redirectWithError('Project access denied.')
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Get organization info using the Linear SDK
    const linearClient = new LinearClient({ accessToken: tokens.access_token })
    const viewer = await linearClient.viewer
    const org = await viewer.organization

    // Store the connection
    const storeResult = await storeLinearConnection(adminSupabase, {
      projectId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
      organizationId: org.id,
      organizationName: org.name,
      installedByUserId: userId,
      installedByEmail: viewer.email ?? null,
    })

    if (!storeResult.success) {
      return redirectWithError('Failed to save Linear connection.')
    }

    // Redirect back to integrations page (validate redirect path to prevent open redirects)
    const defaultPath = `/projects/${projectId}/integrations?linear=connected`
    const safePath = getSafeRedirectPath(redirectUrl, defaultPath)
    return NextResponse.redirect(`${appUrl}${safePath}`)
  } catch (error) {
    console.error('[integrations.linear.callback] unexpected error', error)
    return redirectWithError('An unexpected error occurred.')
  }
}

function redirectWithError(message: string): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const errorUrl = new URL('/projects', appUrl)
  errorUrl.searchParams.set('linear_error', message)
  return NextResponse.redirect(errorUrl.toString())
}
