/**
 * Fathom connect API route.
 * POST - Validate and save API key
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { FathomClient, FathomApiError } from '@/lib/integrations/fathom/client'
import {
  storeFathomCredentials,
  type FathomSyncFrequency,
  type FathomFilterConfig,
} from '@/lib/integrations/fathom'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/fathom/connect
 * Validate and save Fathom API key
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.fathom.connect] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, apiKey, syncFrequency, filterConfig } = body as {
      projectId: string
      apiKey: string
      syncFrequency: FathomSyncFrequency
      filterConfig?: FathomFilterConfig
    }

    // Validate required fields
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'apiKey is required.' }, { status: 400 })
    }
    if (!syncFrequency) {
      return NextResponse.json({ error: 'syncFrequency is required.' }, { status: 400 })
    }

    // Validate sync frequency
    const validFrequencies: FathomSyncFrequency[] = ['manual', '1h', '6h', '24h']
    if (!validFrequencies.includes(syncFrequency)) {
      return NextResponse.json({ error: 'Invalid syncFrequency.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Test the API key
    const client = new FathomClient(apiKey)

    try {
      await client.testConnection()
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

    // Store credentials
    const result = await storeFathomCredentials({
      projectId,
      apiKey,
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

    console.error('[integrations.fathom.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to connect Fathom.' }, { status: 500 })
  }
}
