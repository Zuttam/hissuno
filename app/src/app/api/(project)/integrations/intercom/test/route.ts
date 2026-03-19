/**
 * Intercom test connection API route.
 * POST - Test an access token without storing it
 */

import { NextRequest, NextResponse } from 'next/server'
import { IntercomClient, IntercomApiError } from '@/lib/integrations/intercom/client'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/intercom/test
 * Test an Intercom access token by calling the /me endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accessToken } = body as { accessToken: string }

    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken is required.' }, { status: 400 })
    }

    const client = new IntercomClient(accessToken)

    try {
      const workspace = await client.testConnection()
      return NextResponse.json({
        success: true,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
      })
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
  } catch (error) {
    console.error('[integrations.intercom.test] unexpected error', error)
    return NextResponse.json({ error: 'Failed to test connection.' }, { status: 500 })
  }
}
