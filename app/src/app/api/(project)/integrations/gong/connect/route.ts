/**
 * Gong connect API route.
 * POST - Validate and save API credentials
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { GongClient, GongApiError } from '@/lib/integrations/gong/client'
import {
  storeGongCredentials,
  type GongSyncFrequency,
  type GongFilterConfig,
} from '@/lib/integrations/gong'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/gong/connect
 * Validate and save Gong API credentials
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.gong.connect] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, accessKey, accessKeySecret, baseUrl, syncFrequency, filterConfig } = body as {
      projectId: string
      accessKey: string
      accessKeySecret: string
      baseUrl: string
      syncFrequency: GongSyncFrequency
      filterConfig?: GongFilterConfig
    }

    // Validate required fields
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }
    if (!accessKey) {
      return NextResponse.json({ error: 'accessKey is required.' }, { status: 400 })
    }
    if (!accessKeySecret) {
      return NextResponse.json({ error: 'accessKeySecret is required.' }, { status: 400 })
    }
    if (!baseUrl) {
      return NextResponse.json({ error: 'baseUrl is required.' }, { status: 400 })
    }
    if (!syncFrequency) {
      return NextResponse.json({ error: 'syncFrequency is required.' }, { status: 400 })
    }

    // Validate sync frequency
    const validFrequencies: GongSyncFrequency[] = ['manual', '1h', '6h', '24h']
    if (!validFrequencies.includes(syncFrequency)) {
      return NextResponse.json({ error: 'Invalid syncFrequency.' }, { status: 400 })
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

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Test the credentials
    const client = new GongClient(accessKey, accessKeySecret, baseUrl)

    try {
      await client.testConnection()
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

    // Store credentials
    const result = await storeGongCredentials({
      projectId,
      accessKey,
      accessKeySecret,
      baseUrl,
      syncFrequency,
      filterConfig,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.gong.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to connect Gong.' }, { status: 500 })
  }
}
