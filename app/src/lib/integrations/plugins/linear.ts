/**
 * Linear plugin — sync issues from a Linear team into Hissuno.
 *
 * Auth: OAuth 2.0 (read, write, issues:create, comments:create).
 * Streams: issues (parameterized per team — one stream per team).
 * Custom handlers: teams (list available teams for instance selection).
 */

import { LinearClient } from '@linear/sdk'
import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import {
  definePlugin,
  type SyncCtx,
  type PluginRouteCtx,
  type PluginListCtx,
} from '../plugin-kit'

const filterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  stateTypes: z.array(z.string()).optional(),
})

type LinearFilters = z.infer<typeof filterSchema>

export const linearPlugin = definePlugin({
  id: 'linear',
  name: 'Linear',
  description: 'Pull issues from Linear teams into Hissuno.',
  category: 'issues',
  icon: { src: '/logos/linear.svg' },
  multiInstance: true,

  auth: {
    type: 'oauth2',
    scopes: ['read', 'write', 'issues:create', 'comments:create'],
    authorizeUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    clientIdEnv: 'LINEAR_CLIENT_ID',
    clientSecretEnv: 'LINEAR_CLIENT_SECRET',
    extraAuthParams: { prompt: 'consent' },
    onTokenExchanged: async (tokens) => {
      const client = new LinearClient({ accessToken: tokens.accessToken })
      const viewer = await client.viewer
      const org = await viewer.organization
      return {
        externalAccountId: org.id,
        accountLabel: org.name,
        credentials: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt?.toISOString(),
        },
        settings: {
          organizationId: org.id,
          organizationName: org.name,
          viewerEmail: viewer.email,
        },
      }
    },
  },

  streams: {
    issues: {
      kind: 'issues',
      label: 'Issues',
      description: 'Issues from a Linear team.',
      filterSchema,
      defaultFilters: {},
      instances: async (ctx) => listTeams(ctx),
      sync: runIssuesSync,
    },
  },

  customHandlers: {
    teams: async (_req: NextRequest, ctx: PluginRouteCtx) => {
      if (!ctx.credentials) {
        return NextResponse.json({ error: 'Connection required.' }, { status: 404 })
      }
      const client = new LinearClient({ accessToken: String(ctx.credentials.accessToken) })
      const teams = await client.teams()
      return NextResponse.json({
        teams: teams.nodes.map((t) => ({ id: t.id, name: t.name, key: t.key })),
      })
    },
  },
})

async function listTeams(ctx: PluginListCtx) {
  const client = new LinearClient({ accessToken: String(ctx.credentials.accessToken) })
  const teams = await client.teams()
  return teams.nodes.map((t) => ({
    id: t.id,
    label: `${t.name} (${t.key})`,
    metadata: { key: t.key, name: t.name },
  }))
}

async function runIssuesSync(ctx: SyncCtx<Record<string, unknown>, LinearFilters>) {
  const teamId = ctx.instanceId
  if (!teamId) throw new Error('Linear sync requires a team instance.')

  const client = new LinearClient({ accessToken: String(ctx.credentials.accessToken) })
  const team = await client.team(teamId)
  if (!team) throw new Error(`Linear team ${teamId} not found.`)

  const filter: Record<string, unknown> = {}
  if (ctx.filters.fromDate) filter.createdAt = { gte: ctx.filters.fromDate }
  if (ctx.syncMode === 'incremental' && ctx.lastSyncAt) {
    filter.updatedAt = { gte: ctx.lastSyncAt.toISOString() }
  }

  const alreadySynced = await ctx.getSyncedIds()

  let issuesConnection = await client.issues({ filter: { team: { id: { eq: teamId } }, ...filter }, first: 50 })
  let processed = 0
  let total = 0

  while (!ctx.signal.aborted) {
    total += issuesConnection.nodes.length
    for (const issue of issuesConnection.nodes) {
      if (ctx.signal.aborted) break
      if (alreadySynced.has(issue.id)) {
        ctx.progress({ type: 'skipped', externalId: issue.id, message: `Skipped ${issue.identifier}` })
        continue
      }
      try {
        const state = await issue.state
        const stateType = state?.type
        const { issueId } = await ctx.ingest.issue({
          externalId: issue.id,
          name: issue.title,
          description: issue.description ?? '',
          type: 'change_request',
          status: mapLinearState(stateType),
          priority: mapLinearPriority(issue.priority),
          customFields: {
            linear_identifier: issue.identifier,
            linear_url: issue.url,
            linear_team_id: teamId,
          },
        })
        processed++
        ctx.progress({
          type: 'synced',
          externalId: issue.id,
          hissunoId: issueId,
          message: `Synced ${issue.identifier}`,
          current: processed,
          total,
        })
      } catch (err) {
        ctx.logger.error('issue ingest failed', {
          issueId: issue.id,
          error: err instanceof Error ? err.message : String(err),
        })
        ctx.progress({ type: 'failed', externalId: issue.id, message: String(err) })
      }
    }

    if (!issuesConnection.pageInfo.hasNextPage) break
    issuesConnection = await issuesConnection.fetchNext()
  }
}

function mapLinearState(type: string | undefined): 'open' | 'ready' | 'in_progress' | 'resolved' | 'closed' {
  switch (type) {
    case 'backlog':
      return 'open'
    case 'unstarted':
      return 'ready'
    case 'started':
      return 'in_progress'
    case 'completed':
      return 'resolved'
    case 'canceled':
      return 'closed'
    default:
      return 'open'
  }
}

function mapLinearPriority(priority: number | undefined): 'low' | 'medium' | 'high' | undefined {
  if (priority == null) return undefined
  if (priority >= 1 && priority <= 2) return 'high'
  if (priority === 3) return 'medium'
  if (priority >= 4) return 'low'
  return undefined
}
