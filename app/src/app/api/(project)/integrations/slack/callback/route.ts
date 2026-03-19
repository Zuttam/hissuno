import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { getSafeRedirectPath } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { storeSlackToken } from '@/lib/integrations/slack'
import { exchangeSlackOAuthCode, SlackClient } from '@/lib/integrations/slack/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/slack/callback
 * Handles Slack OAuth callback after user authorizes
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.slack.callback] Database must be configured')
    return redirectWithError('Database must be configured.')
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

    // Verify HMAC signature and decode state
    const [statePayload, stateSignature] = state.split('.')
    if (!statePayload || !stateSignature) {
      return redirectWithError('Invalid state parameter.')
    }

    const expectedSig = crypto.createHmac('sha256', clientSecret).update(statePayload).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(stateSignature), Buffer.from(expectedSig))) {
      return redirectWithError('Invalid state signature.')
    }

    let stateData: {
      projectId: string
      userId: string
      nonce: string
      redirectUrl?: string
    }
    try {
      stateData = JSON.parse(Buffer.from(statePayload, 'base64url').toString('utf-8'))
    } catch {
      return redirectWithError('Invalid state parameter.')
    }

    const { projectId, userId, redirectUrl } = stateData

    if (!projectId || !userId) {
      return redirectWithError('Invalid state data.')
    }
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true, user_id: true },
    })

    if (!project) {
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

    // Store the token
    const storeResult = await storeSlackToken({
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

    // Redirect to provided URL or default integrations page
    const defaultPath = `/projects/${projectId}/integrations?slack=connected`
    const safePath = getSafeRedirectPath(redirectUrl ?? defaultPath, defaultPath)
    return NextResponse.redirect(`${appUrl}${safePath}`)
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
