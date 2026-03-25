import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { getSafeRedirectPath } from '@/lib/auth/server'
import { assertProjectAccess } from '@/lib/auth/authorization'
import { storeGitHubInstallation } from '@/lib/integrations/github'
import { getInstallationInfo } from '@/lib/integrations/github/jwt'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/github/callback
 * Handles GitHub App installation callback
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin

  if (!isDatabaseConfigured()) {
    console.error('[integrations.github.callback] Database must be configured')
    return redirectWithError('Database must be configured.', origin)
  }

  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!privateKey) {
    return redirectWithError('GitHub integration not configured.', origin)
  }

  try {
    // GitHub App installation sends: installation_id, setup_action, state
    const installationId = request.nextUrl.searchParams.get('installation_id')
    const setupAction = request.nextUrl.searchParams.get('setup_action')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    // Handle user declining installation
    if (error) {
      console.log('[integrations.github.callback] User declined:', error)
      return redirectWithError('GitHub App installation was declined.', origin)
    }

    if (!installationId || !state) {
      console.error('[integrations.github.callback] Missing installation_id or state')
      return redirectWithError('Missing installation_id or state.', origin)
    }

    console.log('[integrations.github.callback] Received installation:', {
      installationId,
      setupAction,
    })

    // Verify HMAC signature and decode state
    const [statePayload, stateSignature] = state.split('.')
    if (!statePayload || !stateSignature) {
      return redirectWithError('Invalid state parameter.', origin)
    }

    const expectedSig = crypto.createHmac('sha256', privateKey).update(statePayload).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(stateSignature), Buffer.from(expectedSig))) {
      return redirectWithError('Invalid state signature.', origin)
    }

    let stateData: { projectId: string; userId: string; nonce: string; redirectUrl: string }
    try {
      stateData = JSON.parse(Buffer.from(statePayload, 'base64url').toString('utf-8'))
    } catch {
      return redirectWithError('Invalid state parameter.', origin)
    }

    const { projectId, userId, redirectUrl } = stateData

    if (!projectId || !userId) {
      return redirectWithError('Invalid state data.', origin)
    }

    // Verify the project exists
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true, user_id: true },
    })

    if (!project) {
      return redirectWithError('Project not found.', origin)
    }

    try {
      await assertProjectAccess({ type: 'user' as const, userId, email: null, name: null }, projectId)
    } catch {
      return redirectWithError('Project access denied.', origin)
    }

    // Fetch installation details from GitHub
    const installationInfo = await getInstallationInfo(Number(installationId))

    // Store the installation
    const storeResult = await storeGitHubInstallation({
      projectId,
      installationId: Number(installationId),
      accountLogin: installationInfo.account.login,
      accountId: installationInfo.account.id,
      targetType: installationInfo.account.type,
      installedByUserId: userId,
    })

    if (!storeResult.success) {
      console.error('[integrations.github.callback] Failed to store installation:', storeResult.error)
      return redirectWithError('Failed to save GitHub connection.', origin)
    }

    // Redirect back to the page specified in state (validate path to prevent open redirects)
    const defaultPath = `/projects/${projectId}/integrations?github=connected`
    const safePath = getSafeRedirectPath(redirectUrl, defaultPath)
    return NextResponse.redirect(`${appUrl}${safePath}`)
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
