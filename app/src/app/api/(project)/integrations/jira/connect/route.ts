import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getJiraOAuthUrl } from '@/lib/integrations/jira/oauth'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/jira/connect?projectId=xxx
 * Initiates Jira OAuth 2.0 (3LO) flow
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const clientId = process.env.JIRA_CLIENT_ID
  const clientSecret = process.env.JIRA_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/jira/callback`

  if (!clientId || !clientSecret) {
    console.error('[integrations.jira.connect] Missing JIRA_CLIENT_ID')
    return NextResponse.json({ error: 'Jira integration not configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()

    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    await assertProjectAccess(identity, projectId)

    // Generate HMAC-signed state for CSRF protection
    const redirectUrl = `/projects/${projectId}/integrations?jira=connected`

    const payload = Buffer.from(
      JSON.stringify({
        projectId,
        userId: identity.userId,
        redirectUrl,
      })
    ).toString('base64url')
    const signature = crypto.createHmac('sha256', clientSecret).update(payload).digest('base64url')
    const state = `${payload}.${signature}`

    const oauthUrl = getJiraOAuthUrl({
      clientId,
      redirectUri,
      state,
    })

    return NextResponse.redirect(oauthUrl)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[integrations.jira.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to initiate Jira connection.' }, { status: 500 })
  }
}
