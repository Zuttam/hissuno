/**
 * Gong plugin — syncs Gong calls and transcripts as Hissuno sessions.
 *
 * Auth: Basic auth (access key + access key secret + region base URL).
 * Streams: calls (sessions kind).
 */

import { z } from 'zod'
import { definePlugin, type SyncCtx } from '../plugin-kit'
import {
  GongClient,
  GongApiError,
  GongRateLimitError,
  type GongCallListItem,
  type GongCallTranscript,
} from '../gong/client'
import {
  mapParticipantToSenderType,
  getParticipantName,
  buildSpeakerMap,
  generateSessionName,
  buildUserMetadata,
} from '../gong/sync-helpers'

const filterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
})

type GongFilters = z.infer<typeof filterSchema>

interface GongCredentials {
  accessKey: string
  accessKeySecret: string
  baseUrl: string
}

export const gongPlugin = definePlugin({
  id: 'gong',
  name: 'Gong',
  description: 'Sync Gong calls and transcripts as sessions.',
  category: 'sessions',
  icon: { src: '/logos/gong.svg' },
  multiInstance: true,

  auth: {
    type: 'api_key',
    fields: [
      { id: 'accessKey', label: 'Access Key', secret: true, required: true },
      { id: 'accessKeySecret', label: 'Access Key Secret', secret: true, required: true },
      {
        id: 'baseUrl',
        label: 'API Base URL',
        placeholder: 'https://us-12345.api.gong.io',
        required: true,
        helpText: 'Region-specific base URL from Gong API settings.',
      },
    ],
    test: async (credentials) => {
      const accessKey = String(credentials.accessKey ?? '').trim()
      const accessKeySecret = String(credentials.accessKeySecret ?? '').trim()
      const baseUrl = String(credentials.baseUrl ?? '').trim()
      if (!accessKey || !accessKeySecret || !baseUrl) {
        throw new Error('Access key, secret, and base URL are required.')
      }
      const client = new GongClient(accessKey, accessKeySecret, baseUrl)
      await client.testConnection()
      const host = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`).host
      return {
        externalAccountId: host,
        accountLabel: host,
        credentials: { accessKey, accessKeySecret, baseUrl } satisfies GongCredentials,
      }
    },
  },

  streams: {
    calls: {
      kind: 'sessions',
      label: 'Calls',
      description: 'Recorded calls with transcripts.',
      filterSchema,
      defaultFilters: {},
      sync: runCallsSync,
    },
  },
})

async function runCallsSync(ctx: SyncCtx<Record<string, unknown>, GongFilters>) {
  const creds = ctx.credentials as unknown as GongCredentials
  if (!creds.accessKey || !creds.accessKeySecret || !creds.baseUrl) {
    throw new Error('Gong credentials are incomplete.')
  }
  const client = new GongClient(creds.accessKey, creds.accessKeySecret, creds.baseUrl)

  let fromDate = ctx.filters.fromDate ? new Date(ctx.filters.fromDate) : undefined
  const toDate = ctx.filters.toDate ? new Date(ctx.filters.toDate) : undefined
  if (ctx.syncMode === 'incremental' && ctx.lastSyncAt) {
    if (!fromDate || ctx.lastSyncAt > fromDate) fromDate = ctx.lastSyncAt
  }

  const alreadySynced = await ctx.getSyncedIds()

  try {
    const callsToSync: GongCallListItem[] = []

    for await (const call of client.listAllCalls({
      fromDate,
      toDate,
      onProgress: (fetched, total) =>
        ctx.progress({ type: 'found', current: fetched, total, message: `Scanning... ${fetched}/${total}` }),
    })) {
      if (ctx.signal.aborted) break
      if (alreadySynced.has(call.id)) {
        ctx.progress({ type: 'skipped', externalId: call.id, message: `Skipped ${call.title || call.id}` })
        continue
      }
      callsToSync.push(call)
    }

    if (callsToSync.length && !ctx.signal.aborted) {
      try {
        const partiesMap = await client.getCallsWithParties(callsToSync.map((c) => c.id))
        for (const call of callsToSync) {
          const p = partiesMap.get(call.id)
          if (p) call.parties = p
        }
      } catch (err) {
        ctx.logger.warn('party enrichment failed', { error: String(err) })
      }
    }

    for (let i = 0; i < callsToSync.length; i++) {
      if (ctx.signal.aborted) break
      const call = callsToSync[i]
      try {
        let transcript: GongCallTranscript | null = null
        try {
          const transcripts = await client.getTranscripts([call.id])
          transcript = transcripts[0] ?? null
        } catch (err) {
          ctx.logger.warn('transcript fetch failed', { callId: call.id, error: String(err) })
        }
        const sessionId = await ingestCall(ctx, call, transcript)
        ctx.progress({
          type: 'synced',
          externalId: call.id,
          hissunoId: sessionId,
          message: `Synced ${call.title || call.id}`,
          current: i + 1,
          total: callsToSync.length,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        ctx.logger.error('call ingest failed', { callId: call.id, error: message })
        ctx.progress({ type: 'failed', externalId: call.id, message })
      }
    }
  } catch (err) {
    if (err instanceof GongRateLimitError) {
      throw new Error(`Rate limit exceeded. Retry after ${err.retryAfter}s.`)
    }
    if (err instanceof GongApiError) {
      throw new Error(`Gong API error: ${err.message}`)
    }
    throw err
  }
}

async function ingestCall(
  ctx: SyncCtx<Record<string, unknown>, GongFilters>,
  call: GongCallListItem,
  transcript: GongCallTranscript | null
): Promise<string> {
  const parties = call.parties ?? []
  const speakerMap = buildSpeakerMap(parties)
  const external = parties.find((p) => p.affiliation === 'external') ?? null
  const userId = external?.emailAddress || external?.name || null
  const userMetadata = buildUserMetadata(call, external)

  const messages: Array<{ senderType: string; content: string; createdAt?: Date }> = []
  if (transcript?.transcript) {
    const startedMs = new Date(call.started).getTime()
    for (const entry of transcript.transcript) {
      const participant = speakerMap.get(entry.speakerId)
      const speaker = participant ? getParticipantName(participant) : 'Unknown Speaker'
      const senderType = participant ? mapParticipantToSenderType(participant) : 'human_agent'
      const text = entry.sentences.map((s) => s.text).join(' ').trim()
      if (!text) continue
      const offset = entry.sentences[0]?.start ?? 0
      messages.push({
        senderType,
        content: `[${speaker}]: ${text}`,
        createdAt: new Date(startedMs + offset),
      })
    }
  }

  const { sessionId } = await ctx.ingest.session({
    externalId: call.id,
    source: 'gong',
    sessionType: 'meeting',
    status: 'closed',
    name: generateSessionName(call),
    userMetadata: { ...userMetadata, ...(userId ? { userId } : {}) },
    firstMessageAt: new Date(call.started),
    lastActivityAt: new Date(new Date(call.started).getTime() + call.duration * 1000),
    createdAt: new Date(call.started),
    messages,
    contactEmail: external?.emailAddress ?? undefined,
    contactName: external?.name ?? undefined,
  })
  return sessionId
}
