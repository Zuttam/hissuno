import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { getSafeRedirectPath } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { storeIntercomCredentials } from '@/lib/integrations/intercom'
import { exchangeIntercomOAuthCode } from '@/lib/integrations/intercom/oauth'
import { IntercomClient } from '@/lib/integrations/intercom/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/intercom/callback
 * Handles Intercom OAuth callback after user authorizes
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.intercom.callback] Database must be configured')
    return redirectWithError('Database must be configured.')
  }

  const clientId = process.env.INTERCOM_CLIENT_ID
  const clientSecret = process.env.INTERCOM_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!clientId || !clientSecret) {
    console.error('[integrations.intercom.callback] Missing Intercom OAuth configuration')
    return redirectWithError('Intercom integration not configured.')
  }

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    // Handle user declining authorization
    if (error) {
      console.log('[integrations.intercom.callback] User declined:', error)
      return redirectWithError('Intercom authorization was declined.')
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

    // Exchange code for access token
    const { token } = await exchangeIntercomOAuthCode({
      code,
      clientId,
      clientSecret,
    })

    // Validate token by fetching workspace info
    const intercomClient = new IntercomClient(token)
    const workspace = await intercomClient.testConnection()

    // Store credentials with oauth auth method
    const storeResult = await storeIntercomCredentials({
      projectId,
      accessToken: token,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      syncFrequency: 'manual',
      authMethod: 'oauth',
    })

    if (!storeResult.success) {
      console.error('[integrations.intercom.callback] Failed to store credentials:', storeResult.error)
      return redirectWithError('Failed to save Intercom connection.')
    }

    // Redirect back to integrations page (validate path to prevent open redirects)
    const defaultPath = `/projects/${projectId}/integrations?intercom=connected`
    const safePath = getSafeRedirectPath(redirectUrl, defaultPath)
    return NextResponse.redirect(`${appUrl}${safePath}`)
  } catch (error) {
    console.error('[integrations.intercom.callback] unexpected error', error)
    return redirectWithError('An unexpected error occurred.')
  }
}

function redirectWithError(message: string): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const errorUrl = new URL('/projects', appUrl)
  errorUrl.searchParams.set('intercom_error', message)
  return NextResponse.redirect(errorUrl.toString())
}
