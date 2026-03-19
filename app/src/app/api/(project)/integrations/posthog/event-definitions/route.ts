/**
 * PostHog event definitions API route.
 * GET - Fetch available event definitions for config UI
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { PosthogClient, PosthogApiError } from '@/lib/integrations/posthog/client'
import { getPosthogCredentials } from '@/lib/integrations/posthog'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/posthog/event-definitions?projectId=xxx
 * Fetch event and property definitions from PostHog
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const credentials = await getPosthogCredentials(projectId)
    if (!credentials) {
      return NextResponse.json({ error: 'PostHog is not connected.' }, { status: 400 })
    }

    const client = new PosthogClient(
      credentials.apiKey,
      credentials.host,
      credentials.posthogProjectId
    )

    const [eventDefinitions, propertyDefinitions] = await Promise.all([
      client.getEventDefinitions(),
      client.getPropertyDefinitions('person'),
    ])

    return NextResponse.json({
      eventDefinitions,
      propertyDefinitions,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof PosthogApiError) {
      return NextResponse.json({ error: `PostHog API error: ${error.message}` }, { status: 502 })
    }

    console.error('[integrations.posthog.event-definitions] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch event definitions.' }, { status: 500 })
  }
}
