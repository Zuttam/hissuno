import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { getSafeRedirectPath } from '@/lib/auth/server'
import { assertProjectAccess } from '@/lib/auth/authorization'
import { exchangeCodeForTokens, getAccessibleResources } from '@/lib/integrations/jira/oauth'
import { storeJiraConnection } from '@/lib/integrations/jira'
import type { JiraOAuthState } from '@/types/jira'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/jira/callback
 * Handles Jira OAuth callback after user authorizes
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return redirectWithError('Database must be configured.')
  }

  const clientId = process.env.JIRA_CLIENT_ID
  const clientSecret = process.env.JIRA_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/jira/callback`

  if (!clientId || !clientSecret) {
    return redirectWithError('Jira integration not configured.')
  }

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    // Handle user declining authorization
    if (error) {
      console.log('[integrations.jira.callback] User declined:', error)
      return redirectWithError('Jira authorization was declined.')
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

    let stateData: JiraOAuthState
    try {
      stateData = JSON.parse(Buffer.from(statePayload, 'base64url').toString('utf-8'))
    } catch {
      return redirectWithError('Invalid state parameter.')
    }

    const { projectId, userId, redirectUrl } = stateData

    if (!projectId || !userId) {
      return redirectWithError('Invalid state data.')
    }

    // Verify the project exists
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true, user_id: true },
    })

    if (!project) {
      return redirectWithError('Project not found.')
    }

    try {
      await assertProjectAccess({ type: 'user' as const, userId, email: null, name: null }, projectId)
    } catch {
      return redirectWithError('Project access denied.')
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })

    // Get accessible resources to find the Jira cloud ID
    const resources = await getAccessibleResources(tokens.access_token)

    if (resources.length === 0) {
      return redirectWithError('No Jira sites found. Make sure you have access to a Jira Cloud site.')
    }

    // Use the first accessible resource
    const resource = resources[0]
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Store the connection
    const storeResult = await storeJiraConnection({
      projectId,
      cloudId: resource.id,
      siteUrl: resource.url,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
      installedByUserId: userId,
      installedByEmail: null, // Will be set when user configures
    })

    if (!storeResult.success) {
      return redirectWithError('Failed to save Jira connection.')
    }

    // Redirect back to integrations page (validate redirect path to prevent open redirects)
    const defaultPath = `/projects/${projectId}/integrations?jira=connected`
    const safePath = getSafeRedirectPath(redirectUrl, defaultPath)
    return NextResponse.redirect(`${appUrl}${safePath}`)
  } catch (error) {
    console.error('[integrations.jira.callback] unexpected error', error)
    return redirectWithError('An unexpected error occurred.')
  }
}

function redirectWithError(message: string): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const errorUrl = new URL('/projects', appUrl)
  errorUrl.searchParams.set('jira_error', message)
  return NextResponse.redirect(errorUrl.toString())
}
