import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { LinearClient } from '@linear/sdk'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getLinearOAuthUrl } from '@/lib/integrations/linear/oauth'
import { storeLinearConnection } from '@/lib/integrations/linear'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/linear/connect?projectId=xxx
 * Initiates Linear OAuth flow
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const clientId = process.env.LINEAR_CLIENT_ID
  const clientSecret = process.env.LINEAR_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/linear/callback`

  if (!clientId || !clientSecret) {
    console.error('[integrations.linear.connect] Missing LINEAR_CLIENT_ID')
    return NextResponse.json({ error: 'Linear integration not configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()

    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    await assertProjectAccess(identity, projectId)

    // Generate HMAC-signed state for CSRF protection
    const redirectUrl = `/projects/${projectId}/integrations?linear=connected`

    const payload = Buffer.from(
      JSON.stringify({
        projectId,
        userId: identity.userId,
        redirectUrl,
      })
    ).toString('base64url')
    const signature = crypto.createHmac('sha256', clientSecret).update(payload).digest('base64url')
    const state = `${payload}.${signature}`

    const oauthUrl = getLinearOAuthUrl({
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
    console.error('[integrations.linear.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to initiate Linear connection.' }, { status: 500 })
  }
}

/**
 * POST /api/integrations/linear/connect
 * Connect Linear using a personal API key
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()

    const body = await request.json()
    const { projectId, apiKey } = body

    if (!projectId || !apiKey) {
      return NextResponse.json({ error: 'projectId and apiKey are required' }, { status: 400 })
    }

    if (!apiKey.startsWith('lin_api_')) {
      return NextResponse.json(
        { error: 'Invalid API key format. Linear API keys start with lin_api_' },
        { status: 400 }
      )
    }

    await assertProjectAccess(identity, projectId)

    // Validate the API key by fetching viewer + org info
    const client = new LinearClient({ apiKey })
    const viewer = await client.viewer
    const org = await viewer.organization

    const storeResult = await storeLinearConnection({
      projectId,
      accessToken: apiKey,
      refreshToken: null,
      tokenExpiresAt: null,
      organizationId: org.id,
      organizationName: org.name,
      installedByUserId: identity.userId,
      installedByEmail: viewer.email ?? null,
      authMethod: 'token',
    })

    if (!storeResult.success) {
      return NextResponse.json({ error: storeResult.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      organizationName: org.name,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[integrations.linear.connect] POST error', error)
    return NextResponse.json(
      { error: 'Failed to connect Linear. Please check your API key.' },
      { status: 500 }
    )
  }
}
