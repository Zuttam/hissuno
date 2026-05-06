/**
 * Notion plugin — connect-only.
 *
 * Auth: custom (Notion uses JSON + Basic auth for token exchange, which doesn't
 *   match the generic OAuth2 form-urlencoded pattern). No refresh tokens.
 * Sync logic lives in `src/lib/automations/skills/notion-issues/` and
 * `src/lib/automations/skills/notion-knowledge/`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import {
  definePlugin,
  type CustomAuthCtx,
  type PluginRouteCtx,
} from '../plugin-kit'
import { NotionClient } from '../notion/client'
import { exchangeNotionOAuthCode } from '../notion/oauth'

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
      const dbInfo = await client.getDatabase(databaseId)
      return NextResponse.json({ database: dbInfo })
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

function extractTitleFromProperties(props: Record<string, unknown>): string {
  for (const prop of Object.values(props)) {
    const p = prop as { type?: string; title?: Array<{ plain_text: string }> }
    if (p?.type === 'title' && Array.isArray(p.title)) {
      return p.title.map((t) => t.plain_text).join('')
    }
  }
  return ''
}
