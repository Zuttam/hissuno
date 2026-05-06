/**
 * Notion plugin — sync issues (database rows → Hissuno issues) and knowledge
 * (pages → knowledge sources).
 *
 * Auth: custom (Notion uses JSON + Basic auth for token exchange, which doesn't
 *   match the generic OAuth2 form-urlencoded pattern). No refresh tokens.
 * Streams:
 *   - issues: parameterized per notion_database_id, with field_mapping in settings
 *   - knowledge: parameterized per root page id, with include_children flag
 */

import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import {
  definePlugin,
  type CustomAuthCtx,
  type SyncCtx,
  type PluginRouteCtx,
  type PluginListCtx,
} from '../plugin-kit'
import { NotionClient, type NotionPage } from '../notion/client'
import { exchangeNotionOAuthCode } from '../notion/oauth'
import { extractStringByPropertyName, mapPropertyValue } from '../notion/sync-issue-helpers'
import { blocksToMarkdown } from '../notion/blocks-to-markdown'
import { extractPageTitle } from '../notion/sync-knowledge-helpers'
import { resolveTargetScopeId } from '../shared/scope-helpers'

const issuesFilterSchema = z.object({})
const issuesSettingsSchema = z.object({
  databaseId: z.string(),
  fieldMapping: z.object({
    title: z.string(),
    description: z.string().optional(),
    type: z.string().optional(),
    typeValueMap: z.record(z.string()).optional(),
    priority: z.string().optional(),
    priorityValueMap: z.record(z.string()).optional(),
    status: z.string().optional(),
    statusValueMap: z.record(z.string()).optional(),
    customFields: z.array(z.string()).optional(),
  }),
})

const knowledgeFilterSchema = z.object({})
const knowledgeSettingsSchema = z.object({
  rootPageId: z.string(),
  includeChildren: z.boolean().optional(),
  /** Target product scope for ingested pages. Defaults to the project's default scope. */
  productScopeId: z.string().uuid().optional(),
})

type NotionIssuesSettings = z.infer<typeof issuesSettingsSchema>
type NotionKnowledgeSettings = z.infer<typeof knowledgeSettingsSchema>

const VALID_TYPES = new Set(['bug', 'feature_request', 'change_request'])
const VALID_PRIORITIES = new Set(['low', 'medium', 'high'])
const VALID_STATUSES = new Set(['open', 'ready', 'in_progress', 'resolved', 'closed'])

export const notionPlugin = definePlugin({
  id: 'notion',
  name: 'Notion',
  description: 'Sync Notion databases as issues and pages as knowledge.',
  category: 'knowledge',
  icon: { src: '/logos/notion.svg' },
  multiInstance: true,

  auth: {
    type: 'custom',
    connect: async (req: NextRequest, ctx: CustomAuthCtx) => {
      const body = await req.json().catch(() => ({})) as { code?: string; redirectUri?: string }
      const clientId = process.env.NOTION_CLIENT_ID
      const clientSecret = process.env.NOTION_CLIENT_SECRET
      if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'Notion OAuth is not configured.' }, { status: 500 })
      }
      if (!body.code || !body.redirectUri) {
        // Initial call — return the authorize URL for the client to redirect to.
        const url = new URL('https://api.notion.com/v1/oauth/authorize')
        url.searchParams.set('client_id', clientId)
        url.searchParams.set('redirect_uri', body.redirectUri ?? '')
        url.searchParams.set('response_type', 'code')
        url.searchParams.set('owner', 'user')
        url.searchParams.set('state', ctx.projectId)
        return NextResponse.json({ authorizeUrl: url.toString() })
      }
      const tokens = await exchangeNotionOAuthCode({
        code: body.code,
        clientId,
        clientSecret,
        redirectUri: body.redirectUri,
      })
      const result = await ctx.saveConnection({
        externalAccountId: tokens.workspace_id,
        accountLabel: tokens.workspace_name ?? tokens.workspace_id,
        credentials: { accessToken: tokens.access_token, botId: tokens.bot_id },
        settings: {
          workspaceId: tokens.workspace_id,
          workspaceName: tokens.workspace_name,
          workspaceIcon: tokens.workspace_icon,
        },
      })
      return NextResponse.json({ connectionId: result.connectionId })
    },
  },

  streams: {
    issues: {
      kind: 'issues',
      label: 'Issues',
      description: 'Rows from a Notion database mapped to Hissuno issues.',
      filterSchema: issuesFilterSchema,
      settingsSchema: issuesSettingsSchema,
      instances: async (ctx) => listDatabases(ctx),
      sync: runIssuesSync,
    },
    knowledge: {
      kind: 'knowledge',
      label: 'Knowledge',
      description: 'Notion pages imported as knowledge sources.',
      filterSchema: knowledgeFilterSchema,
      settingsSchema: knowledgeSettingsSchema,
      instances: async (ctx) => listPages(ctx),
      sync: runKnowledgeSync,
    },
  },

  customHandlers: {
    databases: async (_req: NextRequest, ctx: PluginRouteCtx) => {
      if (!ctx.credentials) return NextResponse.json({ error: 'Connection required.' }, { status: 404 })
      const client = new NotionClient(String(ctx.credentials.accessToken))
      const data = await client.search({ filter: { property: 'object', value: 'database' }, pageSize: 100 })
      return NextResponse.json({
        databases: data.results
          .filter((r) => r.object === 'database')
          .map((d) => ({
            id: d.id,
            title: d.title?.map((t) => t.plain_text).join('') || 'Untitled',
            url: d.url,
          })),
      })
    },
    databaseSchema: async (req: NextRequest, ctx: PluginRouteCtx) => {
      if (!ctx.credentials) return NextResponse.json({ error: 'Connection required.' }, { status: 404 })
      const url = new URL(req.url)
      const databaseId = url.searchParams.get('databaseId')
      if (!databaseId) return NextResponse.json({ error: 'databaseId required.' }, { status: 400 })
      const client = new NotionClient(String(ctx.credentials.accessToken))
      const db = await client.getDatabase(databaseId)
      return NextResponse.json({ database: db })
    },
    pages: async (req: NextRequest, ctx: PluginRouteCtx) => {
      if (!ctx.credentials) return NextResponse.json({ error: 'Connection required.' }, { status: 404 })
      const url = new URL(req.url)
      const query = url.searchParams.get('query') ?? undefined
      const startCursor = url.searchParams.get('startCursor') ?? undefined
      const client = new NotionClient(String(ctx.credentials.accessToken))
      const data = await client.search({
        query,
        filter: { property: 'object', value: 'page' },
        pageSize: 50,
        startCursor,
      })
      return NextResponse.json({
        pages: data.results
          .filter((r) => r.object === 'page')
          .map((p) => ({
            id: p.id,
            title: p.properties ? extractTitleFromProperties(p.properties) : 'Untitled',
            url: p.url,
            icon: p.icon,
          })),
        hasMore: data.has_more,
        nextCursor: data.next_cursor,
      })
    },
    childPages: async (req: NextRequest, ctx: PluginRouteCtx) => {
      if (!ctx.credentials) return NextResponse.json({ error: 'Connection required.' }, { status: 404 })
      const url = new URL(req.url)
      const pageId = url.searchParams.get('pageId')
      if (!pageId) return NextResponse.json({ error: 'pageId required.' }, { status: 400 })
      const client = new NotionClient(String(ctx.credentials.accessToken))
      const blocks = await client.getAllPageBlocks(pageId)
      const childPages = blocks
        .filter((b) => b.type === 'child_page')
        .map((b) => ({ id: b.id, title: (b.child_page as { title?: string } | undefined)?.title ?? 'Untitled' }))
      return NextResponse.json({ pages: childPages })
    },
  },
})

async function listDatabases(ctx: PluginListCtx) {
  const client = new NotionClient(String(ctx.credentials.accessToken))
  const data = await client.search({ filter: { property: 'object', value: 'database' }, pageSize: 100 })
  return data.results
    .filter((r) => r.object === 'database')
    .map((d) => ({
      id: d.id,
      label: d.title?.map((t) => t.plain_text).join('') || 'Untitled',
      metadata: { url: d.url },
    }))
}

async function listPages(ctx: PluginListCtx) {
  const client = new NotionClient(String(ctx.credentials.accessToken))
  const data = await client.search({ filter: { property: 'object', value: 'page' }, pageSize: 100 })
  return data.results
    .filter((r) => r.object === 'page')
    .map((p) => ({
      id: p.id,
      label: (p.properties ? extractTitleFromProperties(p.properties) : '') || 'Untitled page',
      metadata: { url: p.url },
    }))
}

function extractTitleFromProperties(props: Record<string, unknown>): string {
  for (const prop of Object.values(props)) {
    const p = prop as { type?: string; title?: Array<{ plain_text: string }> }
    if (p?.type === 'title' && Array.isArray(p.title)) {
      return p.title.map((t) => t.plain_text).join('')
    }
  }
  return ''
}

async function runIssuesSync(ctx: SyncCtx) {
  const settings = ctx.settings as NotionIssuesSettings
  const databaseId = ctx.instanceId ?? settings.databaseId
  if (!databaseId) throw new Error('Notion issues sync requires a database.')
  const fieldMapping = settings.fieldMapping
  if (!fieldMapping?.title) throw new Error('Field mapping requires at least a title mapping.')

  const client = new NotionClient(String(ctx.credentials.accessToken))
  const pages = await client.getAllDatabasePages(databaseId)

  for (let i = 0; i < pages.length; i++) {
    if (ctx.signal.aborted) break
    const page = pages[i]
    const properties = page.properties as Record<string, unknown>

    const title = extractStringByPropertyName(properties, fieldMapping.title) || 'Untitled'
    let description = fieldMapping.description
      ? extractStringByPropertyName(properties, fieldMapping.description)
      : ''
    if (!description) {
      try {
        const blocks = await client.getAllPageBlocks(page.id, 5)
        description = blocksToMarkdown(blocks)
      } catch {
        description = ''
      }
    }

    const issueType = mapPropertyValue(properties, fieldMapping.type, fieldMapping.typeValueMap, 'feature_request', VALID_TYPES) as
      'bug' | 'feature_request' | 'change_request'
    const priority = mapPropertyValue(properties, fieldMapping.priority, fieldMapping.priorityValueMap, 'medium', VALID_PRIORITIES) as
      'low' | 'medium' | 'high'
    const status = mapPropertyValue(properties, fieldMapping.status, fieldMapping.statusValueMap, 'open', VALID_STATUSES) as
      'open' | 'ready' | 'in_progress' | 'resolved' | 'closed'

    const customFields: Record<string, unknown> = {
      notion_page_id: page.id,
      notion_url: page.url,
      notion_database_id: databaseId,
    }
    if (fieldMapping.customFields) {
      for (const propName of fieldMapping.customFields) {
        const val = extractStringByPropertyName(properties, propName)
        if (val !== '') {
          customFields[propName.toLowerCase().replace(/[^a-z0-9_]/g, '_')] = val
        }
      }
    }

    try {
      const { issueId } = await ctx.ingest.issue({
        externalId: page.id,
        name: title,
        description,
        type: issueType,
        status,
        priority,
        customFields,
      })
      ctx.progress({
        type: 'synced',
        externalId: page.id,
        hissunoId: issueId,
        message: `Synced ${title}`,
        current: i + 1,
        total: pages.length,
      })
    } catch (err) {
      ctx.logger.error('issue ingest failed', {
        pageId: page.id,
        error: err instanceof Error ? err.message : String(err),
      })
      ctx.progress({ type: 'failed', externalId: page.id, message: String(err) })
    }
  }
}

async function runKnowledgeSync(ctx: SyncCtx) {
  const settings = ctx.settings as NotionKnowledgeSettings
  const rootPageId = ctx.instanceId ?? settings.rootPageId
  if (!rootPageId) throw new Error('Notion knowledge sync requires a root page.')
  const includeChildren = settings.includeChildren ?? true
  const productScopeId = await resolveTargetScopeId(ctx.projectId, settings.productScopeId)

  const client = new NotionClient(String(ctx.credentials.accessToken))
  const queue: string[] = [rootPageId]
  const visited = new Set<string>()
  let processed = 0

  while (queue.length && !ctx.signal.aborted) {
    const pageId = queue.shift()!
    if (visited.has(pageId)) continue
    visited.add(pageId)

    let page: NotionPage
    try {
      page = await client.getPage(pageId)
    } catch (err) {
      ctx.logger.warn('failed to fetch page', {
        pageId,
        error: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    try {
      const blocks = await client.getAllPageBlocks(pageId)
      const markdown = blocksToMarkdown(blocks)
      const { docId } = await ctx.ingest.knowledge({
        externalId: pageId,
        type: 'notion',
        notionPageId: pageId,
        name: extractPageTitle(page),
        url: page.url,
        analyzedContent: markdown,
        origin: 'notion_sync',
        productScopeId,
        skipInlineProcessing: true,
      })
      processed++
      ctx.progress({
        type: 'synced',
        externalId: pageId,
        hissunoId: docId,
        message: `Synced ${extractPageTitle(page)}`,
        current: processed,
        total: processed + queue.length,
      })

      if (includeChildren) {
        for (const block of blocks) {
          if (block.type === 'child_page' && !visited.has(block.id)) queue.push(block.id)
        }
        try {
          const dbResponse = await client.getDatabasePages(pageId)
          for (const dbPage of dbResponse.results) {
            if (!visited.has(dbPage.id)) queue.push(dbPage.id)
          }
        } catch {
          // Not a database — fine.
        }
      }
    } catch (err) {
      ctx.logger.error('knowledge ingest failed', {
        pageId,
        error: err instanceof Error ? err.message : String(err),
      })
      ctx.progress({ type: 'failed', externalId: pageId, message: String(err) })
    }
  }
}
