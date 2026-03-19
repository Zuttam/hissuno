import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError, getSafeRedirectPath } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getSlackOAuthUrl, SLACK_OAUTH_SCOPES } from '@/lib/integrations/slack'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/slack/connect?projectId=xxx
 * Initiates Slack OAuth flow
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.slack.connect] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/slack/callback`

  if (!clientId || !clientSecret) {
    console.error('[integrations.slack.connect] Missing Slack OAuth configuration')
    return NextResponse.json({ error: 'Slack integration not configured.' }, { status: 500 })
  }

  try {
    // Get authenticated user
    const identity = await requireUserIdentity()

    // Get query params
    const projectId = request.nextUrl.searchParams.get('projectId')
    const nextUrl = request.nextUrl.searchParams.get('nextUrl')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    await assertProjectAccess(identity, projectId)

    // Generate state with projectId and redirect info for CSRF protection
    const nonce = crypto.randomUUID()

    // Determine redirect path - use explicit nextUrl if provided and valid
    let redirectPath: string | undefined
    if (nextUrl) {
      const safePath = getSafeRedirectPath(nextUrl)
      // Security: ensure nextUrl is for the same project
      if (safePath.includes(projectId)) {
        const url = new URL(safePath, appUrl)
        if (!url.searchParams.has('slack')) {
          url.searchParams.set('slack', 'connected')
        }
        redirectPath = `${url.pathname}${url.search}`
      }
    }

    // Generate HMAC-signed state for CSRF protection
    const statePayload = Buffer.from(
      JSON.stringify({
        projectId,
        userId: identity.userId,
        nonce,
        redirectUrl: redirectPath,
      })
    ).toString('base64url')
    const signature = crypto.createHmac('sha256', clientSecret).update(statePayload).digest('base64url')
    const state = `${statePayload}.${signature}`

    const oauthUrl = getSlackOAuthUrl({
      clientId,
      redirectUri,
      state,
      scopes: SLACK_OAUTH_SCOPES,
    })

    // Redirect to Slack OAuth
    return NextResponse.redirect(oauthUrl)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.slack.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to initiate Slack connection.' }, { status: 500 })
  }
}
