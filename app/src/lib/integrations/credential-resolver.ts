/**
 * Credential resolver for skill-driven sync.
 *
 * Skills declare `requires.plugins: ['slack', ...]` in their SKILL.md
 * frontmatter. At run-time the harness calls `resolveConnectionToken()` to get
 * the active access token for each required plugin and injects it into the
 * sandbox env. OAuth tokens that are about to expire are refreshed in-place;
 * the refreshed credentials are persisted back to integration_connections so
 * subsequent runs see the new value.
 *
 * Single source of truth for runtime credential access — every code path
 * that needs a plugin's access token at run-time goes through here.
 */

import { db } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { integrationConnections } from '@/lib/db/schema/app'
import { getPlugin } from './registry'
import { refreshAccessToken } from './shared/oauth'
import type {
  Credentials,
  PluginDef,
  Logger,
  Settings,
} from './plugin-kit'

export interface ResolvedConnection {
  connectionId: string
  pluginId: string
  externalAccountId: string
  accountLabel: string
  /** The active access token / api key. Empty string if the plugin has no single token (e.g. github_app). */
  accessToken: string
  /** Full credentials map (post-refresh). May contain refreshToken, scopes, etc. */
  credentials: Credentials
  /** Plugin-side settings (workspace metadata, etc.). */
  settings: Settings
}

export interface ResolveOptions {
  /** Pick a specific connection by external account id (workspace, org, …). Required if the project has more than one connection for this plugin. */
  externalAccountId?: string
  /** Or pick a specific connection by id. */
  connectionId?: string
  /** Custom logger. Defaults to a no-op. */
  logger?: Logger
}

const REFRESH_LEEWAY_MS = 60 * 1000

const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
}

/**
 * Look up the active connection for (projectId, pluginId), refresh OAuth tokens
 * if expiring soon, and return the resolved credentials.
 *
 * Throws if no connection exists, the plugin id is unknown, or the project has
 * multiple connections and no selector was provided.
 */
export async function resolveConnectionToken(
  projectId: string,
  pluginId: string,
  options: ResolveOptions = {},
): Promise<ResolvedConnection> {
  const plugin = getPlugin(pluginId)
  if (!plugin) {
    throw new Error(`Unknown plugin "${pluginId}"`)
  }

  const logger = options.logger ?? noopLogger

  let row
  if (options.connectionId) {
    const rows = await db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.id, options.connectionId))
      .limit(1)
    row = rows[0]
    if (row && (row.project_id !== projectId || row.plugin_id !== pluginId)) {
      throw new Error(`Connection ${options.connectionId} does not belong to (${projectId}, ${pluginId})`)
    }
  } else if (options.externalAccountId) {
    const rows = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.project_id, projectId),
          eq(integrationConnections.plugin_id, pluginId),
          eq(integrationConnections.external_account_id, options.externalAccountId),
        ),
      )
      .limit(1)
    row = rows[0]
  } else {
    const rows = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.project_id, projectId),
          eq(integrationConnections.plugin_id, pluginId),
        ),
      )
      .orderBy(desc(integrationConnections.created_at))
      .limit(2)
    if (rows.length > 1) {
      throw new Error(
        `Project ${projectId} has multiple "${pluginId}" connections; pass options.externalAccountId or options.connectionId to select one`,
      )
    }
    row = rows[0]
  }

  if (!row) {
    throw new Error(`No "${pluginId}" connection for project ${projectId}`)
  }

  const credentials = (row.credentials ?? {}) as Credentials
  const refreshed = await maybeRefreshOAuth({
    plugin,
    credentials,
    connectionId: row.id,
    projectId,
    logger,
  })

  return {
    connectionId: row.id,
    pluginId,
    externalAccountId: row.external_account_id,
    accountLabel: row.account_label,
    accessToken: extractAccessToken(refreshed),
    credentials: refreshed,
    settings: (row.settings ?? {}) as Settings,
  }
}

function extractAccessToken(credentials: Credentials): string {
  // OAuth flows store the token under `accessToken`. API-key plugins use
  // varying field names (apiToken, apiKey, …); when there's no obvious single
  // token the resolver returns an empty string and callers fall back to
  // reading the full `credentials` map.
  for (const key of ['accessToken', 'access_token', 'apiToken', 'apiKey', 'api_key', 'token']) {
    const value = credentials[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return ''
}

async function maybeRefreshOAuth(params: {
  plugin: PluginDef
  credentials: Credentials
  connectionId: string
  projectId: string
  logger: Logger
}): Promise<Credentials> {
  const { plugin, credentials, connectionId, projectId, logger } = params
  if (plugin.auth.type !== 'oauth2') return credentials

  const expiresAt = credentials.expiresAt
  const refreshToken = credentials.refreshToken
  if (!refreshToken || typeof refreshToken !== 'string') return credentials
  if (!expiresAt) return credentials

  const expiresAtMs = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : NaN
  if (isNaN(expiresAtMs) || expiresAtMs - Date.now() > REFRESH_LEEWAY_MS) return credentials

  logger.info('refreshing OAuth access token', { pluginId: plugin.id })

  try {
    let next: Credentials
    if (plugin.auth.refresh) {
      next = await plugin.auth.refresh(credentials, {
        projectId,
        plugin,
        fetch,
        logger,
      })
    } else {
      const tokens = await refreshAccessToken({
        auth: plugin.auth,
        refreshToken,
        logger,
      })
      next = {
        ...credentials,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? refreshToken,
        expiresAt: tokens.expiresAt?.toISOString() ?? credentials.expiresAt,
      }
    }

    await db
      .update(integrationConnections)
      .set({ credentials: next, updated_at: new Date() })
      .where(eq(integrationConnections.id, connectionId))
    return next
  } catch (err) {
    logger.warn('OAuth refresh failed — continuing with existing credentials', {
      error: err instanceof Error ? err.message : String(err),
    })
    return credentials
  }
}
