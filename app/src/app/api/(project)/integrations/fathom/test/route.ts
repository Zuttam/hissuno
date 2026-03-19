/**
 * Fathom test connection API route.
 * POST - Test API key without storing it
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { FathomClient, FathomApiError } from '@/lib/integrations/fathom/client'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/fathom/test
 * Test Fathom API key by making a lightweight API call
 */
export async function POST(request: NextRequest) {
  try {
    await requireRequestIdentity()

    const body = await request.json()
    const { apiKey } = body as { apiKey: string }

    if (!apiKey) {
      return NextResponse.json({ error: 'apiKey is required.' }, { status: 400 })
    }

    const client = new FathomClient(apiKey)

    try {
      await client.testConnection()
      return NextResponse.json({
        success: true,
      })
    } catch (error) {
      if (error instanceof FathomApiError) {
        if (error.statusCode === 401 || error.statusCode === 403) {
          return NextResponse.json({ error: 'Invalid API key.' }, { status: 400 })
        }
        return NextResponse.json(
          { error: `Fathom API error: ${error.message}` },
          { status: 400 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('[integrations.fathom.test] unexpected error', error)
    return NextResponse.json({ error: 'Failed to test connection.' }, { status: 500 })
  }
}
