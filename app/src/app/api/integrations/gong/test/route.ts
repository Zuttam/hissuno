/**
 * Gong test connection API route.
 * POST - Test API credentials without storing them
 */

import { NextRequest, NextResponse } from 'next/server'
import { GongClient, GongApiError } from '@/lib/integrations/gong/client'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/gong/test
 * Test Gong API credentials by making a lightweight API call
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accessKey, accessKeySecret } = body as {
      accessKey: string
      accessKeySecret: string
    }

    if (!accessKey || !accessKeySecret) {
      return NextResponse.json({ error: 'accessKey and accessKeySecret are required.' }, { status: 400 })
    }

    const client = new GongClient(accessKey, accessKeySecret)

    try {
      await client.testConnection()
      return NextResponse.json({
        success: true,
      })
    } catch (error) {
      if (error instanceof GongApiError) {
        if (error.statusCode === 401) {
          return NextResponse.json({ error: 'Invalid API credentials.' }, { status: 400 })
        }
        return NextResponse.json(
          { error: `Gong API error: ${error.message}` },
          { status: 400 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('[integrations.gong.test] unexpected error', error)
    return NextResponse.json({ error: 'Failed to test connection.' }, { status: 500 })
  }
}
