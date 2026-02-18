import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { storeSlackToken } from '@/lib/integrations/slack'
import { exchangeSlackOAuthCode, SlackClient } from '@/lib/integrations/slack/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/slack/callback
 * Handles Slack OAuth callback after user authorizes
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.slack.callback] Supabase must be configured')
    return redirectWithError('Supabase must be configured.')
  }

  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/slack/callback`

  if (!clientId || !clientSecret) {
    console.error('[integrations.slack.callback] Missing Slack OAuth configuration')
    return redirectWithError('Slack integration not configured.')
  }

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    // Handle user declining authorization
    if (error) {
      console.log('[integrations.slack.callback] User declined:', error)
      return redirectWithError('Slack authorization was declined.')
    }

    if (!code || !state) {
      return redirectWithError('Missing authorization code or state.')
    }

    // Decode and validate state
    let stateData: {
      projectId: string
      userId: string
      nonce: string
      redirectUrl?: string
      returnStep?: string
      mode?: string
    }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
    } catch {
      return redirectWithError('Invalid state parameter.')
    }

    const { projectId, userId, redirectUrl, returnStep = 'sessions', mode = 'edit' } = stateData

    if (!projectId || !userId) {
      return redirectWithError('Invalid state data.')
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
      return redirectWithError('Project not found.')
    }

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      return redirectWithError('Project access denied.')
    }

    // Exchange code for access token
    const tokenResponse = await exchangeSlackOAuthCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })

    if (!tokenResponse.ok || !tokenResponse.access_token) {
      console.error('[integrations.slack.callback] Token exchange failed:', tokenResponse.error)
      return redirectWithError('Failed to complete Slack authorization.')
    }

    // Get workspace info using the new token
    const slackClient = new SlackClient(tokenResponse.access_token)
    const teamInfo = await slackClient.getTeamInfo()

    // Get installer's email
    let installerEmail: string | null = null
    if (tokenResponse.authed_user?.id) {
      installerEmail = await slackClient.getUserEmail(tokenResponse.authed_user.id)
    }

    // Store the token using admin client (reuse from above)
    const storeResult = await storeSlackToken(adminSupabase, {
      projectId,
      workspaceId: tokenResponse.team?.id || '',
      workspaceName: tokenResponse.team?.name || teamInfo?.name || null,
      workspaceDomain: teamInfo?.domain || null,
      botToken: tokenResponse.access_token,
      botUserId: tokenResponse.bot_user_id || '',
      installedByUserId: tokenResponse.authed_user?.id || null,
      installedByEmail: installerEmail,
      scope: tokenResponse.scope || null,
    })

    if (!storeResult.success) {
      console.error('[integrations.slack.callback] Failed to store token:', storeResult.error)
      return redirectWithError('Failed to save Slack connection.')
    }

    // Redirect based on redirectUrl (new) or mode (legacy)
    if (redirectUrl) {
      // New flow: use explicit redirect URL from state (already has slack=connected)
      return NextResponse.redirect(redirectUrl)
    }

    // Legacy flow: construct URL based on mode/returnStep
    let successUrl: URL
    if (mode === 'create') {
      // Redirect back to create wizard with step
      successUrl = new URL('/projects/new', appUrl)
      successUrl.searchParams.set('restored', 'true')
      successUrl.searchParams.set('step', returnStep)
      successUrl.searchParams.set('slack', 'connected')
    } else {
      // Redirect to edit page with step
      successUrl = new URL(`/projects/${projectId}/edit`, appUrl)
      successUrl.searchParams.set('restored', 'true')
      successUrl.searchParams.set('step', returnStep)
      successUrl.searchParams.set('slack', 'connected')
    }
    return NextResponse.redirect(successUrl.toString())
  } catch (error) {
    console.error('[integrations.slack.callback] unexpected error', error)
    return redirectWithError('An unexpected error occurred.')
  }
}

function redirectWithError(message: string): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const errorUrl = new URL('/projects', appUrl)
  errorUrl.searchParams.set('slack_error', message)
  return NextResponse.redirect(errorUrl.toString())
}
