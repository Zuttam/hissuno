/**
 * HubSpot OAuth callback route.
 * Handles the redirect back from HubSpot after user authorizes.
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { getSafeRedirectPath } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { storeHubSpotCredentials } from '@/lib/integrations/hubspot'
import { exchangeHubSpotOAuthCode } from '@/lib/integrations/hubspot/oauth'
import { HubSpotClient } from '@/lib/integrations/hubspot/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/hubspot/callback
 * Handles HubSpot OAuth callback after user authorizes
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return redirectWithError('Database must be configured.')
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/hubspot/callback`

  if (!clientId || !clientSecret) {
    return redirectWithError('HubSpot integration not configured.')
  }

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    if (error) {
      console.log('[integrations.hubspot.callback] User declined:', error)
      return redirectWithError('HubSpot authorization was declined.')
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

    // Verify the project exists
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

    // Exchange code for tokens
    const tokens = await exchangeHubSpotOAuthCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })

    // Validate token by fetching account info
    const hubspotClient = new HubSpotClient(tokens.accessToken)
    const accountInfo = await hubspotClient.testConnection()

    // Store credentials with oauth auth method
    const storeResult = await storeHubSpotCredentials({
      projectId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      hubId: String(accountInfo.portalId),
      hubName: accountInfo.uiDomain || null,
      authMethod: 'oauth',
      syncFrequency: 'manual',
    })

    if (!storeResult.success) {
      console.error('[integrations.hubspot.callback] Failed to store credentials:', storeResult.error)
      return redirectWithError('Failed to save HubSpot connection.')
    }

    // Redirect back to integrations page (validate redirect path to prevent open redirects)
    const defaultPath = `/projects/${projectId}/integrations?hubspot=connected`
    const safePath = getSafeRedirectPath(redirectUrl, defaultPath)
    return NextResponse.redirect(`${appUrl}${safePath}`)
  } catch (error) {
    console.error('[integrations.hubspot.callback] unexpected error', error)
    return redirectWithError('An unexpected error occurred.')
  }
}

function redirectWithError(message: string): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const errorUrl = new URL('/projects', appUrl)
  errorUrl.searchParams.set('hubspot_error', message)
  return NextResponse.redirect(errorUrl.toString())
}
