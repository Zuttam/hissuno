/**
 * POST /api/webhooks/[pluginId]
 *
 * Generic webhook receiver. Each plugin's `resolveConnection()` handler
 * verifies the request and either:
 *   - returns a connection id (we fire `webhook.<plugin>` for the project),
 *   - returns a Response (the plugin handled it directly — e.g. a Slack
 *     url_verification challenge),
 *   - returns null (unknown sender → 404).
 *
 * Sync logic itself lives in skills that subscribe to `webhook.<plugin>` —
 * the skill receives the parsed payload as `HISSUNO_RUN_INPUT`.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getPlugin } from '@/lib/integrations/registry'
import { getConnection } from '@/lib/integrations/shared/connections'
import { notifyAutomationEvent } from '@/lib/automations/events'
import type { EventName } from '@/lib/automations/types'
import { handleSlackEvent } from '@/lib/integrations/slack/event-handlers'

type SlackEventPayload = Parameters<typeof handleSlackEvent>[0]['event']

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string }> },
) {
  const { pluginId } = await context.params

  const plugin = getPlugin(pluginId)
  if (!plugin) {
    return NextResponse.json({ error: `Unknown plugin: ${pluginId}` }, { status: 404 })
  }
  if (!plugin.resolveConnection) {
    return NextResponse.json(
      { error: `Plugin ${pluginId} does not accept webhooks.` },
      { status: 405 },
    )
  }

  const rawBody = await request.text()
  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    payload = rawBody
  }

  const resolved = await plugin.resolveConnection({
    payload,
    rawBody,
    request,
  })

  // Plugin handled the request directly (e.g. Slack url_verification).
  if (resolved instanceof Response) return resolved
  if (!resolved) return NextResponse.json({ error: 'Unknown sender.' }, { status: 404 })

  const connection = await getConnection(resolved)
  if (!connection) {
    return NextResponse.json({ error: 'Connection not found.' }, { status: 404 })
  }

  notifyAutomationEvent(`webhook.${pluginId}` as EventName, {
    projectId: connection.projectId,
    input: {
      pluginId,
      connectionId: connection.id,
      externalAccountId: connection.externalAccountId,
      payload,
    },
  })

  // Slack's interactive features (thread capture, bot replies) live in
  // `slack/event-handlers.ts` and haven't been migrated to a sandboxed skill
  // yet. Fire the legacy in-process handler in parallel with the event so
  // existing functionality keeps working.
  if (pluginId === 'slack' && isSlackEventCallback(payload)) {
    void handleSlackEvent({
      teamId: payload.team_id,
      event: payload.event as SlackEventPayload,
      eventId: payload.event_id ?? '',
      eventTime: payload.event_time ?? Math.floor(Date.now() / 1000),
    }).catch((err) => {
      console.error('[webhooks.slack] handler failed', err)
    })
  }

  return NextResponse.json({ ok: true })
}

function isSlackEventCallback(
  payload: unknown,
): payload is { type: 'event_callback'; team_id: string; event: Record<string, unknown>; event_id?: string; event_time?: number } {
  return (
    !!payload &&
    typeof payload === 'object' &&
    (payload as { type?: unknown }).type === 'event_callback' &&
    typeof (payload as { team_id?: unknown }).team_id === 'string' &&
    !!(payload as { event?: unknown }).event
  )
}
