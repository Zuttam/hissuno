/**
 * Zendesk connect API route.
 * POST - Validate and save API credentials
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { ZendeskClient, ZendeskApiError } from '@/lib/integrations/zendesk/client'
import {
  storeZendeskCredentials,
  type ZendeskSyncFrequency,
  type ZendeskFilterConfig,
} from '@/lib/integrations/zendesk'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/zendesk/connect
 * Validate and save Zendesk API credentials
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.zendesk.connect] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, subdomain, email, apiToken, syncFrequency, filterConfig } = body as {
      projectId: string
      subdomain: string
      email: string
      apiToken: string
      syncFrequency: ZendeskSyncFrequency
      filterConfig?: ZendeskFilterConfig
    }

    // Validate required fields
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }
    if (!subdomain) {
      return NextResponse.json({ error: 'subdomain is required.' }, { status: 400 })
    }
    if (!email) {
      return NextResponse.json({ error: 'email is required.' }, { status: 400 })
    }
    if (!apiToken) {
      return NextResponse.json({ error: 'apiToken is required.' }, { status: 400 })
    }
    if (!syncFrequency) {
      return NextResponse.json({ error: 'syncFrequency is required.' }, { status: 400 })
    }

    // Validate sync frequency
    const validFrequencies: ZendeskSyncFrequency[] = ['manual', '1h', '6h', '24h']
    if (!validFrequencies.includes(syncFrequency)) {
      return NextResponse.json({ error: 'Invalid syncFrequency.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Test the credentials
    const client = new ZendeskClient(subdomain.trim(), email.trim(), apiToken.trim())
    let accountInfo

    try {
      accountInfo = await client.testConnection()
    } catch (error) {
      if (error instanceof ZendeskApiError) {
        if (error.statusCode === 401) {
          return NextResponse.json({ error: 'Invalid credentials.' }, { status: 400 })
        }
        return NextResponse.json(
          { error: `Zendesk API error: ${error.message}` },
          { status: 400 }
        )
      }
      throw error
    }

    // Store credentials
    const result = await storeZendeskCredentials({
      projectId,
      subdomain: subdomain.trim(),
      adminEmail: email.trim(),
      apiToken: apiToken.trim(),
      accountName: accountInfo.name,
      syncFrequency,
      filterConfig,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      accountName: accountInfo.name,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.zendesk.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to connect Zendesk.' }, { status: 500 })
  }
}
