/**
 * PostHog connect API route.
 * POST - Validate API key, test connection, auto-detect event config, and save
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { PosthogClient, PosthogApiError } from '@/lib/integrations/posthog/client'
import {
  storePosthogCredentials,
  type SyncFrequency,
} from '@/lib/integrations/posthog'
import { autoDetectEventConfig } from '@/lib/integrations/posthog/sync'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/posthog/connect
 * Validate and save PostHog API credentials
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, apiKey, host, posthogProjectId, syncFrequency, filterConfig } = body as {
      projectId: string
      apiKey: string
      host?: string
      posthogProjectId: string
      syncFrequency: SyncFrequency
      filterConfig?: { fromDate?: string; toDate?: string; sync_new_contacts?: boolean }
    }

    // Validate required fields
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'apiKey is required.' }, { status: 400 })
    }
    if (!posthogProjectId) {
      return NextResponse.json({ error: 'posthogProjectId is required.' }, { status: 400 })
    }
    // Validate sync frequency (defaults to manual)
    const validFrequencies: SyncFrequency[] = ['manual', '1h', '6h', '24h']
    if (syncFrequency && !validFrequencies.includes(syncFrequency)) {
      return NextResponse.json({ error: 'Invalid syncFrequency.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const resolvedHost = host || 'https://app.posthog.com'

    // Validate PostHog host against allowlist to prevent SSRF
    const ALLOWED_POSTHOG_HOSTS = [
      'https://app.posthog.com',
      'https://eu.posthog.com',
      'https://us.posthog.com',
      'https://eu.i.posthog.com',
      'https://us.i.posthog.com',
    ]
    const normalizedHost = resolvedHost.replace(/\/+$/, '').toLowerCase()
    if (!ALLOWED_POSTHOG_HOSTS.includes(normalizedHost)) {
      return NextResponse.json(
        { error: `Invalid PostHog host. Allowed hosts: ${ALLOWED_POSTHOG_HOSTS.join(', ')}` },
        { status: 400 }
      )
    }

    // Test the credentials
    const client = new PosthogClient(apiKey, resolvedHost, posthogProjectId)

    try {
      await client.testConnection()
    } catch (error) {
      if (error instanceof PosthogApiError) {
        if (error.statusCode === 401) {
          return NextResponse.json({ error: 'Invalid API key.' }, { status: 400 })
        }
        return NextResponse.json(
          { error: `PostHog API error: ${error.message}` },
          { status: 400 }
        )
      }
      throw error
    }

    // Auto-detect event configuration
    let eventConfig
    try {
      eventConfig = await autoDetectEventConfig(client)
    } catch (err) {
      console.warn('[integrations.posthog.connect] Auto-detect failed, using defaults:', err)
      eventConfig = {
        feature_mapping: {},
        signal_events: ['$exception', '$rageclick'],
        person_properties: ['plan', 'email', 'name'],
      }
    }

    // Store credentials
    const result = await storePosthogCredentials({
      projectId,
      apiKey,
      host: resolvedHost,
      posthogProjectId,
      eventConfig,
      filterConfig,
      syncFrequency: syncFrequency || 'manual',
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      eventConfig,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.posthog.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to connect PostHog.' }, { status: 500 })
  }
}
