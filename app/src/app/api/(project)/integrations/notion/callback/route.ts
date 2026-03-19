/**
 * Notion OAuth callback route.
 * GET - Handles OAuth callback after user authorizes
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { getSafeRedirectPath } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { storeNotionCredentials } from '@/lib/integrations/notion'
import { exchangeNotionOAuthCode } from '@/lib/integrations/notion/oauth'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/notion/callback
 * Handles Notion OAuth callback after user authorizes
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.notion.callback] Database must be configured')
    return redirectWithError('Database must be configured.')
  }

  const clientId = process.env.NOTION_CLIENT_ID
  const clientSecret = process.env.NOTION_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/notion/callback`

  if (!clientId || !clientSecret) {
    console.error('[integrations.notion.callback] Missing Notion OAuth configuration')
    return redirectWithError('Notion integration not configured.')
  }

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    // Handle user declining authorization
    if (error) {
      console.log('[integrations.notion.callback] User declined:', error)
      return redirectWithError('Notion authorization was declined.')
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

    // Exchange code for access token
    const tokenData = await exchangeNotionOAuthCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })

    // Store credentials
    const storeResult = await storeNotionCredentials({
      projectId,
      accessToken: tokenData.access_token,
      workspaceId: tokenData.workspace_id,
      workspaceName: tokenData.workspace_name,
      workspaceIcon: tokenData.workspace_icon ?? null,
      botId: tokenData.bot_id,
      installedByUserId: userId,
    })

    if (!storeResult.success) {
      console.error('[integrations.notion.callback] Failed to store credentials:', storeResult.error)
      return redirectWithError('Failed to save Notion connection.')
    }

    // Redirect back to integrations page (validate redirect path to prevent open redirects)
    const defaultPath = `/projects/${projectId}/integrations?notion=connected`
    const safePath = getSafeRedirectPath(redirectUrl, defaultPath)
    return NextResponse.redirect(`${appUrl}${safePath}`)
  } catch (error) {
    console.error('[integrations.notion.callback] unexpected error', error)
    return redirectWithError('An unexpected error occurred.')
  }
}

function redirectWithError(message: string): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const errorUrl = new URL('/projects', appUrl)
  errorUrl.searchParams.set('notion_error', message)
  return NextResponse.redirect(errorUrl.toString())
}
