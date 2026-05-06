/**
 * Fathom plugin — syncs Fathom.ai meetings as Hissuno sessions.
 *
 * Auth: API key via X-Api-Key header.
 * Streams: sessions (meetings -> sessions with transcript messages).
 */

import { z } from 'zod'
import { definePlugin, type SyncCtx } from '../plugin-kit'
import {
  FathomClient,
  FathomApiError,
  FathomRateLimitError,
  type FathomMeeting,
  type FathomTranscriptEntry,
} from '../fathom/client'
import {
  getSpeakerName,
  getSenderType,
  extractSummaryText,
  generateSessionName,
  calculateDuration,
  buildUserMetadata,
} from '../fathom/sync-helpers'

const filterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
})

type FathomFilters = z.infer<typeof filterSchema>

export const fathomPlugin = definePlugin({
  id: 'fathom',
  name: 'Fathom',
  description: 'Sync your Fathom meetings as sessions for analysis.',
  category: 'sessions',
  icon: { src: '/logos/fathom.svg' },
  multiInstance: true,

  auth: {
    type: 'api_key',
    fields: [
      {
        id: 'apiKey',
        label: 'API Key',
        placeholder: 'fathom_...',
        secret: true,
        required: true,
        helpText: 'Generate at Fathom Settings → API.',
      },
    ],
    test: async (credentials) => {
      const apiKey = String(credentials.apiKey ?? '').trim()
      if (!apiKey) throw new Error('API key is required.')
      const client = new FathomClient(apiKey)
      await client.testConnection()
      const accountName = (await client.getAccountName()) ?? 'Fathom'
      return {
        externalAccountId: accountName,
        accountLabel: accountName,
        credentials: { apiKey },
      }
    },
  },

  streams: {
    meetings: {
      kind: 'sessions',
      label: 'Meetings',
      description: 'Recorded meetings with transcripts.',
      filterSchema,
      defaultFilters: {},
      sync: runMeetingsSync,
    },
  },
})

async function runMeetingsSync(ctx: SyncCtx<Record<string, unknown>, FathomFilters>) {
  const apiKey = String(ctx.credentials.apiKey ?? '')
  if (!apiKey) throw new Error('Fathom API key is missing from credentials.')

  const client = new FathomClient(apiKey)

  let createdAfter = ctx.filters.fromDate
    ? new Date(ctx.filters.fromDate).toISOString()
    : undefined
  const createdBefore = ctx.filters.toDate
    ? new Date(ctx.filters.toDate).toISOString()
    : undefined

  if (ctx.syncMode === 'incremental' && ctx.lastSyncAt) {
    const cursor = ctx.lastSyncAt.toISOString()
    if (!createdAfter || cursor > createdAfter) createdAfter = cursor
  }

  const alreadySynced = await ctx.getSyncedIds()
  const toSync: FathomMeeting[] = []

  try {
    for await (const meeting of client.listAllMeetings({
      createdAfter,
      createdBefore,
      includeTranscript: true,
      includeSummary: true,
      onProgress: (found) =>
        ctx.progress({ type: 'found', message: `Scanning... ${found} meetings`, current: found, total: found }),
    })) {
      if (ctx.signal.aborted) break
      if (alreadySynced.has(meeting.id)) {
        ctx.progress({
          type: 'skipped',
          externalId: meeting.id,
          message: `Already synced: ${meeting.title || meeting.id}`,
        })
        continue
      }
      toSync.push(meeting)
    }

    for (let i = 0; i < toSync.length; i++) {
      if (ctx.signal.aborted) break
      const meeting = toSync[i]

      let transcript = meeting.transcript ?? null
      const hasSpeakers = transcript?.some(
        (e: FathomTranscriptEntry) =>
          e.speaker_name || e.speakerName || e.speaker?.name || e.speaker_email || e.speakerEmail || e.speaker?.email
      )
      if (!transcript || !hasSpeakers) {
        try {
          const fetched = await client.getMeetingTranscript(meeting.id)
          if (fetched.length) transcript = fetched
        } catch (err) {
          ctx.logger.warn('failed to fetch transcript', {
            meetingId: meeting.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      let summary = extractSummaryText(meeting.default_summary)
      if (!summary) {
        try {
          const data = await client.getMeetingSummary(meeting.id)
          summary = data.markdown ?? null
        } catch (err) {
          ctx.logger.warn('failed to fetch summary', {
            meetingId: meeting.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      try {
        const { sessionId } = await ctx.ingest.session(buildSessionInput(meeting, transcript, summary))
        ctx.progress({
          type: 'synced',
          externalId: meeting.id,
          hissunoId: sessionId,
          message: `Synced: ${meeting.title || meeting.id}`,
          current: i + 1,
          total: toSync.length,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        ctx.logger.error('meeting ingest failed', { meetingId: meeting.id, error: message })
        ctx.progress({ type: 'failed', externalId: meeting.id, message })
      }
    }
  } catch (err) {
    if (err instanceof FathomRateLimitError) {
      throw new Error(`Rate limit exceeded. Retry after ${err.retryAfter}s.`)
    }
    if (err instanceof FathomApiError) {
      throw new Error(`Fathom API error: ${err.message}`)
    }
    throw err
  }
}

function buildSessionInput(
  meeting: FathomMeeting,
  transcript: FathomTranscriptEntry[] | null,
  summary: string | null
) {
  const invitees = meeting.calendar_invitees ?? []
  const external = invitees.find((i) => i.is_external) ?? null
  const duration = calculateDuration(meeting)
  const startTime =
    meeting.recording_start_time || meeting.scheduled_start_time || meeting.created_at
  const endTime = meeting.recording_end_time || meeting.scheduled_end_time
  const userMetadata = buildUserMetadata(meeting, external)
  const userId = external?.email || external?.name || null

  const messages: Array<{ senderType: string; content: string; createdAt?: Date }> = []

  if (summary) {
    messages.push({
      senderType: 'system',
      content: `[Meeting Summary]\n${summary}`,
      createdAt: new Date(startTime),
    })
  }

  if (transcript) {
    for (const entry of transcript) {
      const text = entry.text?.trim()
      if (!text) continue
      const speaker = getSpeakerName(entry)
      const senderType = getSenderType(entry, invitees)
      const offset = entry.start_time ?? entry.startTime
      const when = offset != null
        ? new Date(new Date(startTime).getTime() + offset * 1000)
        : new Date(startTime)
      messages.push({
        senderType,
        content: `[${speaker}]: ${text}`,
        createdAt: when,
      })
    }
  }

  if (meeting.action_items?.length) {
    const text = meeting.action_items
      .map((i) => `- ${i.text}${i.assignee ? ` (${i.assignee})` : ''}`)
      .join('\n')
    messages.push({
      senderType: 'system',
      content: `[Action Items]\n${text}`,
      createdAt: endTime ? new Date(endTime) : new Date(startTime),
    })
  }

  return {
    externalId: meeting.id,
    source: 'fathom' as const,
    sessionType: 'meeting' as const,
    status: 'closed' as const,
    name: generateSessionName(meeting),
    userMetadata: { ...userMetadata, ...(userId ? { userId } : {}) },
    firstMessageAt: new Date(startTime),
    lastActivityAt: endTime
      ? new Date(endTime)
      : duration
        ? new Date(new Date(startTime).getTime() + duration * 1000)
        : new Date(startTime),
    createdAt: new Date(meeting.created_at),
    messages,
    contactEmail: external?.email,
    contactName: external?.name,
  }
}
