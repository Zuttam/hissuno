/**
 * HubSpot connect API route.
 * GET  - Initiate OAuth flow (redirect to HubSpot)
 * POST - Validate and save private app token credentials
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { HubSpotClient, HubSpotApiError, exchangePersonalAccessKey } from '@/lib/integrations/hubspot/client'
import { getHubSpotOAuthUrl } from '@/lib/integrations/hubspot/oauth'
import {
  storeHubSpotCredentials,
  type SyncFrequency,
  type HubSpotFilterConfig,
} from '@/lib/integrations/hubspot'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/hubspot/connect?projectId=xxx
 * Initiates HubSpot OAuth flow
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/hubspot/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'HubSpot OAuth not configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Generate HMAC-signed state for CSRF protection
    const redirectUrl = `/projects/${projectId}/integrations?hubspot=connected`

    const payload = Buffer.from(
      JSON.stringify({
        projectId,
        userId: identity.type === 'user' ? identity.userId : identity.createdByUserId,
        redirectUrl,
      })
    ).toString('base64url')
    const signature = crypto.createHmac('sha256', clientSecret).update(payload).digest('base64url')
    const state = `${payload}.${signature}`

    const oauthUrl = getHubSpotOAuthUrl({
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

    console.error('[integrations.hubspot.connect] OAuth initiation error', error)
    return NextResponse.json({ error: 'Failed to initiate HubSpot connection.' }, { status: 500 })
  }
}

/**
 * POST /api/integrations/hubspot/connect
 * Validate and save HubSpot private app token credentials
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, accessToken, syncFrequency, filterConfig } = body as {
      projectId: string
      accessToken: string
      syncFrequency: SyncFrequency
      filterConfig?: HubSpotFilterConfig
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }
    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken is required.' }, { status: 400 })
    }
    // Validate sync frequency (defaults to manual)
    const validFrequencies: SyncFrequency[] = ['manual', '1h', '6h', '24h']
    if (syncFrequency && !validFrequencies.includes(syncFrequency)) {
      return NextResponse.json({ error: 'Invalid syncFrequency.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Validate the token - try PAK exchange first, then direct bearer
    let hubId: string
    let hubName: string | null = null

    try {
      const tokenResponse = await exchangePersonalAccessKey(accessToken.trim())
      hubId = String(tokenResponse.hubId)
      hubName = tokenResponse.hubName || null
    } catch {
      // Not a PAK - try as direct bearer token (private app token)
      try {
        const client = new HubSpotClient(accessToken.trim())
        const accountInfo = await client.testConnection()
        hubId = String(accountInfo.portalId)
        hubName = accountInfo.uiDomain || null
      } catch (error) {
        if (error instanceof HubSpotApiError) {
          return NextResponse.json(
            { error: `HubSpot API error (${error.statusCode}): ${error.message}` },
            { status: 400 }
          )
        }
        throw error
      }
    }

    // Store the PAK/token as-is (PAKs are long-lived and re-exchanged on each use)
    const result = await storeHubSpotCredentials({
      projectId,
      accessToken: accessToken.trim(),
      hubId,
      hubName,
      authMethod: 'token',
      syncFrequency: syncFrequency || 'manual',
      filterConfig,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      hubId,
      hubName,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.hubspot.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to connect HubSpot.' }, { status: 500 })
  }
}
