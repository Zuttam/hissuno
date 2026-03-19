/**
 * HubSpot test connection API route.
 * POST - Test a personal access key or private app token without storing it
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { HubSpotClient, HubSpotApiError, exchangePersonalAccessKey } from '@/lib/integrations/hubspot/client'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/hubspot/test
 * Test a HubSpot access token. Tries PAK exchange first, then direct Bearer.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRequestIdentity()

    const body = await request.json()
    const { accessToken } = body as { accessToken: string }

    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken is required.' }, { status: 400 })
    }

    // Try PAK exchange first (personal access keys need to be exchanged)
    try {
      const tokenResponse = await exchangePersonalAccessKey(accessToken.trim())
      return NextResponse.json({
        success: true,
        hubId: String(tokenResponse.hubId),
        hubName: tokenResponse.hubName || String(tokenResponse.hubId),
        authMethod: 'token',
      })
    } catch {
      // Not a PAK - try as a direct bearer token (private app token)
    }

    // Fall back to direct bearer token
    try {
      const client = new HubSpotClient(accessToken.trim())
      const accountInfo = await client.testConnection()
      return NextResponse.json({
        success: true,
        hubId: String(accountInfo.portalId),
        hubName: accountInfo.uiDomain,
        authMethod: 'token',
      })
    } catch (error) {
      if (error instanceof HubSpotApiError) {
        return NextResponse.json(
          { error: `HubSpot API error (${error.statusCode}): ${error.message}` },
          { status: 400 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('[integrations.hubspot.test] unexpected error', error)
    return NextResponse.json({ error: 'Failed to test connection.' }, { status: 500 })
  }
}
