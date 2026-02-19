/**
 * Intercom connect API route.
 * GET  - Initiate OAuth flow (redirect to Intercom)
 * POST - Validate and save API credentials (token flow)
 */

import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { IntercomClient, IntercomApiError } from '@/lib/integrations/intercom/client'
import { getIntercomOAuthUrl } from '@/lib/integrations/intercom/oauth'
import {
  storeIntercomCredentials,
  type IntercomSyncFrequency,
  type IntercomFilterConfig,
} from '@/lib/integrations/intercom'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/intercom/connect?projectId=xxx
 * Initiates Intercom OAuth flow
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.intercom.connect] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const clientId = process.env.INTERCOM_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/intercom/callback`

  if (!clientId) {
    console.error('[integrations.intercom.connect] Missing INTERCOM_CLIENT_ID')
    return NextResponse.json({ error: 'Intercom OAuth not configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)

    const nonce = crypto.randomUUID()
    const redirectUrl = `${appUrl}/projects/${projectId}/integrations?intercom=connected`

    const state = Buffer.from(
      JSON.stringify({
        projectId,
        userId: identity.userId,
        nonce,
        redirectUrl,
      })
    ).toString('base64url')

    const oauthUrl = getIntercomOAuthUrl({
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

    console.error('[integrations.intercom.connect] OAuth initiation error', error)
    return NextResponse.json({ error: 'Failed to initiate Intercom connection.' }, { status: 500 })
  }
}

/**
 * POST /api/integrations/intercom/connect
 * Validate and save Intercom API credentials (token flow)
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.intercom.connect] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, accessToken, syncFrequency, filterConfig } = body as {
      projectId: string
      accessToken: string
      syncFrequency: IntercomSyncFrequency
      filterConfig?: IntercomFilterConfig
    }

    // Validate required fields
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }
    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken is required.' }, { status: 400 })
    }
    if (!syncFrequency) {
      return NextResponse.json({ error: 'syncFrequency is required.' }, { status: 400 })
    }

    // Validate sync frequency
    const validFrequencies: IntercomSyncFrequency[] = ['manual', '1h', '6h', '24h']
    if (!validFrequencies.includes(syncFrequency)) {
      return NextResponse.json({ error: 'Invalid syncFrequency.' }, { status: 400 })
    }

    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    // Test the token by fetching workspace info
    const client = new IntercomClient(accessToken)
    let workspace

    try {
      workspace = await client.testConnection()
    } catch (error) {
      if (error instanceof IntercomApiError) {
        if (error.statusCode === 401) {
          return NextResponse.json({ error: 'Invalid access token.' }, { status: 400 })
        }
        return NextResponse.json(
          { error: `Intercom API error: ${error.message}` },
          { status: 400 }
        )
      }
      throw error
    }

    // Store credentials
    const result = await storeIntercomCredentials(supabase, {
      projectId,
      accessToken,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      syncFrequency,
      filterConfig,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.intercom.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to connect Intercom.' }, { status: 500 })
  }
}
