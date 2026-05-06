/**
 * Slack-events skill — placeholder. The legacy in-process handler still
 * processes Slack events; this script just records what landed for
 * observability while the migration is in flight.
 */

import { writeFileSync } from 'node:fs'

interface RunInput {
  pluginId?: string
  connectionId?: string
  externalAccountId?: string
  payload?: {
    type?: string
    team_id?: string
    event?: { type?: string; channel?: string; thread_ts?: string }
    event_id?: string
  }
}

const raw = process.env.HISSUNO_RUN_INPUT
const input: RunInput = raw ? safeJsonParse(raw) : {}
const ev = input.payload?.event ?? {}

const summary = {
  pluginId: input.pluginId ?? 'slack',
  connectionId: input.connectionId ?? null,
  teamId: input.payload?.team_id ?? input.externalAccountId ?? null,
  eventType: ev.type ?? null,
  channel: ev.channel ?? null,
  threadTs: ev.thread_ts ?? null,
  eventId: input.payload?.event_id ?? null,
  note: 'Legacy in-process handler is the source of truth for now.',
}

writeFileSync('output.json', JSON.stringify(summary, null, 2))
console.log('[slack-events]', JSON.stringify(summary))

function safeJsonParse(text: string): RunInput {
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? (parsed as RunInput) : {}
  } catch {
    return {}
  }
}
