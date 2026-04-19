/**
 * Intercom plugin — syncs conversations as Hissuno sessions.
 *
 * Auth: access token (paste from Intercom Developer Hub).
 * Streams: conversations (sessions kind).
 */

import { z } from 'zod'
import { definePlugin, type SyncCtx } from '../plugin-kit'
import {
  IntercomClient,
  IntercomApiError,
  IntercomRateLimitError,
  type IntercomContact,
  type IntercomConversation,
  type IntercomConversationListItem,
} from '../intercom/client'
import {
  mapAuthorTypeToSenderType,
  buildUserMetadata,
  generateSessionName,
} from '../intercom/sync-helpers'

const filterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
})

type IntercomFilters = z.infer<typeof filterSchema>

export const intercomPlugin = definePlugin({
  id: 'intercom',
  name: 'Intercom',
  description: 'Import your Intercom conversations as sessions.',
  category: 'sessions',
  icon: { src: '/logos/intercom.svg' },
  multiInstance: true,

  auth: {
    type: 'api_key',
    fields: [
      {
        id: 'accessToken',
        label: 'Access Token',
        secret: true,
        required: true,
        helpText: 'Developer Hub → Your app → Authentication → Access Token.',
      },
    ],
    test: async (credentials) => {
      const accessToken = String(credentials.accessToken ?? '').trim()
      if (!accessToken) throw new Error('Access token is required.')
      const client = new IntercomClient(accessToken)
      const workspace = await client.testConnection()
      return {
        externalAccountId: workspace.id,
        accountLabel: workspace.name || workspace.id,
        credentials: { accessToken },
        settings: { workspaceName: workspace.name, region: workspace.region },
      }
    },
  },

  streams: {
    conversations: {
      kind: 'sessions',
      label: 'Conversations',
      description: 'Support conversations with customers.',
      filterSchema,
      defaultFilters: {},
      sync: runConversationsSync,
    },
  },
})

async function runConversationsSync(ctx: SyncCtx<Record<string, unknown>, IntercomFilters>) {
  const token = String(ctx.credentials.accessToken ?? '')
  if (!token) throw new Error('Intercom access token missing from credentials.')
  const client = new IntercomClient(token)

  let fromDate = ctx.filters.fromDate ? new Date(ctx.filters.fromDate) : undefined
  const toDate = ctx.filters.toDate ? new Date(ctx.filters.toDate) : undefined
  if (ctx.syncMode === 'incremental' && ctx.lastSyncAt) {
    if (!fromDate || ctx.lastSyncAt > fromDate) fromDate = ctx.lastSyncAt
  }

  const CONCURRENCY = 5
  const alreadySynced = await ctx.getSyncedIds()
  let total = 0

  const processItem = async (item: IntercomConversationListItem) => {
    if (alreadySynced.has(item.id)) {
      ctx.progress({ type: 'skipped', externalId: item.id, message: `Skipped ${item.id}` })
      return
    }
    try {
      const full = await client.getConversation(item.id)
      const sessionId = await ingestConversation(ctx, client, full)
      ctx.progress({
        type: 'synced',
        externalId: item.id,
        hissunoId: sessionId,
        message: `Synced ${item.id}`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.logger.error('conversation ingest failed', { conversationId: item.id, error: message })
      ctx.progress({ type: 'failed', externalId: item.id, message })
    }
  }

  try {
    let batch: IntercomConversationListItem[] = []
    for await (const conversation of client.searchConversations({
      fromDate,
      toDate,
      onProgress: (_fetched, t) => {
        total = t
        ctx.progress({ type: 'found', current: _fetched, total, message: `Scanning... ${_fetched}/${total}` })
      },
    })) {
      if (ctx.signal.aborted) break
      batch.push(conversation)
      if (batch.length >= CONCURRENCY) {
        await Promise.all(batch.map(processItem))
        batch = []
      }
    }
    if (batch.length) await Promise.all(batch.map(processItem))
  } catch (err) {
    if (err instanceof IntercomRateLimitError) {
      throw new Error(`Rate limit exceeded. Retry after ${err.retryAfter}s.`)
    }
    if (err instanceof IntercomApiError) {
      throw new Error(`Intercom API error: ${err.message}`)
    }
    throw err
  }
}

async function ingestConversation(
  ctx: SyncCtx<Record<string, unknown>, IntercomFilters>,
  client: IntercomClient,
  conversation: IntercomConversation
): Promise<string> {
  const embeddedContact = conversation.contacts?.contacts?.[0] ?? null
  let fullContact: IntercomContact | null = null
  if (embeddedContact?.id) {
    try {
      fullContact = await client.getContact(embeddedContact.id)
    } catch (err) {
      ctx.logger.warn('failed to fetch contact', { contactId: embeddedContact.id, error: String(err) })
      fullContact = embeddedContact
    }
  }

  const userId = fullContact?.external_id || fullContact?.id || null
  const userMetadata = buildUserMetadata(conversation.id, fullContact)

  const messages: Array<{ senderType: string; content: string; createdAt?: Date }> = []
  if (conversation.source?.body) {
    messages.push({
      senderType: mapAuthorTypeToSenderType(conversation.source.author.type),
      content: conversation.source.body,
      createdAt: new Date(conversation.created_at * 1000),
    })
  }
  for (const part of conversation.conversation_parts?.conversation_parts ?? []) {
    if (!part.body || part.part_type === 'assignment' || part.part_type === 'close') continue
    messages.push({
      senderType: mapAuthorTypeToSenderType(part.author.type),
      content: part.body,
      createdAt: new Date(part.created_at * 1000),
    })
  }

  const { sessionId } = await ctx.ingest.session({
    externalId: conversation.id,
    source: 'intercom',
    sessionType: 'chat',
    status: 'closed',
    name: generateSessionName(conversation),
    userMetadata: { ...userMetadata, ...(userId ? { userId } : {}) },
    firstMessageAt: new Date(conversation.created_at * 1000),
    lastActivityAt: new Date(conversation.updated_at * 1000),
    createdAt: new Date(conversation.created_at * 1000),
    messages,
    contactEmail: fullContact?.email ?? undefined,
    contactName: fullContact?.name ?? undefined,
  })
  return sessionId
}
