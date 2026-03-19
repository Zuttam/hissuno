/**
 * Gong test connection API route.
 * POST - Test API credentials without storing them
 */

import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { GongClient, GongApiError } from '@/lib/integrations/gong/client'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/gong/test
 * Test Gong API credentials by making a lightweight API call
 */
export async function POST(request: NextRequest) {
  try {
    await requireRequestIdentity()

    const body = await request.json()
    const { accessKey, accessKeySecret, baseUrl } = body as {
      accessKey: string
      accessKeySecret: string
      baseUrl: string
    }

    if (!accessKey || !accessKeySecret || !baseUrl) {
      return NextResponse.json({ error: 'accessKey, accessKeySecret, and baseUrl are required.' }, { status: 400 })
    }

    // Validate Gong baseUrl to prevent SSRF
    try {
      const parsed = new URL(baseUrl)
      const hostname = parsed.hostname.toLowerCase()
      if (hostname !== 'api.gong.io' && !hostname.endsWith('.api.gong.io')) {
        return NextResponse.json(
          { error: 'Invalid baseUrl. Must be api.gong.io or a subdomain of api.gong.io.' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json({ error: 'Invalid baseUrl format.' }, { status: 400 })
    }

    const client = new GongClient(accessKey, accessKeySecret, baseUrl)

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
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[integrations.gong.test] unexpected error', error)
    return NextResponse.json({ error: 'Failed to test connection.' }, { status: 500 })
  }
}
