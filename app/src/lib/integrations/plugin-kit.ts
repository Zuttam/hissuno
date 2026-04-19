/**
 * Plugin kit: the contract every integration plugin implements.
 *
 * A plugin is a single `PluginDef` object produced by `definePlugin(...)`.
 * It declares:
 *   - metadata (id, name, icon, category)
 *   - auth schema (how users connect this integration)
 *   - streams (what data flows in — sessions, contacts, issues, knowledge, ...)
 *   - optional UI escape hatch (custom React dialog for complex flows)
 *   - optional custom API handlers (for integration-specific endpoints)
 *
 * Plugin authors never touch DB schema, API routes, cron, or UI chrome.
 * All of that is shared infrastructure that looks up the plugin by id and delegates.
 */

import type { NextRequest } from 'next/server'
import type { LazyExoticComponent, ComponentType } from 'react'
import type { ZodSchema } from 'zod'

// ============================================================================
// Shared primitives
// ============================================================================

export type SyncFrequency = 'manual' | '1h' | '6h' | '24h' | 'webhook'
export type SyncMode = 'incremental' | 'full'
export type TriggerSource = 'manual' | 'cron' | 'webhook'
export type StreamKind =
  | 'sessions'
  | 'contacts'
  | 'companies'
  | 'issues'
  | 'knowledge'
  | 'analytics'

export type Credentials = Record<string, unknown>
export type Settings = Record<string, unknown>
export type FilterConfig = Record<string, unknown>

// ============================================================================
// Auth schema
// ============================================================================

export interface AuthFieldDef {
  /** Key in the credentials jsonb (e.g. 'apiToken', 'subdomain'). */
  id: string
  label: string
  placeholder?: string
  /** If true, the UI masks the value as a password. */
  secret?: boolean
  required?: boolean
  helpText?: string
  /** Optional regex validated client-side. */
  pattern?: string
}

/** API key / api token / shared-secret auth. */
export interface ApiKeyAuthSchema {
  type: 'api_key'
  fields: AuthFieldDef[]
  /**
   * Server-side validation: given submitted field values, call the provider
   * to verify the credentials and return the external account identifier +
   * a human-readable label. Throw on failure.
   */
  test: (
    credentials: Credentials,
    ctx: AuthTestCtx
  ) => Promise<AuthTestResult>
}

/** Standard OAuth 2.0 authorization-code flow. */
export interface OAuth2AuthSchema {
  type: 'oauth2'
  scopes: string[]
  authorizeUrl: string
  tokenUrl: string
  clientIdEnv: string
  clientSecretEnv: string
  /** Extra params to append to the authorize URL. */
  extraAuthParams?: Record<string, string>
  /** Extra params to send with the token request. */
  extraTokenParams?: Record<string, string>
  /**
   * Called after successful token exchange. Extract account id + label from the
   * provider (often a /me call). Stored on integration_connections.
   */
  onTokenExchanged: (
    tokens: OAuth2Tokens,
    ctx: AuthTestCtx
  ) => Promise<AuthTestResult>
  /**
   * Optional refresh handler. If absent and the provider issues refresh_tokens,
   * the generic runtime will POST to tokenUrl with grant_type=refresh_token.
   */
  refresh?: (
    credentials: Credentials,
    ctx: AuthTestCtx
  ) => Promise<Credentials>
}

/** GitHub App installation flow (special case — managed via installation webhook). */
export interface GitHubAppAuthSchema {
  type: 'github_app'
  /**
   * Called to resolve the installation during connect, given the installation_id
   * returned by the "Install app" redirect. Returns account id + label.
   */
  onInstallation: (
    installationId: number,
    ctx: AuthTestCtx
  ) => Promise<AuthTestResult>
}

/**
 * Escape hatch for anything non-standard (Slack's oauth.v2.access, custom flows).
 * The plugin handles its own connect request end-to-end.
 */
export interface CustomAuthSchema {
  type: 'custom'
  /**
   * Handle POST /api/plugins/[pluginId]/connect directly.
   * Must call ctx.saveConnection(...) on success.
   */
  connect: (req: NextRequest, ctx: CustomAuthCtx) => Promise<Response>
  /** Optional custom callback handler, used if the flow is a redirect. */
  callback?: (req: NextRequest, ctx: CustomAuthCtx) => Promise<Response>
}

export type AuthSchema =
  | ApiKeyAuthSchema
  | OAuth2AuthSchema
  | GitHubAppAuthSchema
  | CustomAuthSchema

export interface OAuth2Tokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  tokenType?: string
  scope?: string
  raw?: Record<string, unknown>
}

export interface AuthTestCtx {
  projectId: string
  plugin: PluginDef
  fetch: typeof fetch
  logger: Logger
}

export interface CustomAuthCtx extends AuthTestCtx {
  /**
   * Save a new connection. Returns the connection id.
   * Used by plugins with `auth.type === 'custom'`.
   */
  saveConnection: (input: {
    externalAccountId: string
    accountLabel: string
    credentials: Credentials
    settings?: Settings
  }) => Promise<{ connectionId: string }>
  /** Update an existing connection's credentials (reconnect flow). */
  updateConnection: (
    connectionId: string,
    input: {
      credentials?: Credentials
      settings?: Settings
      accountLabel?: string
    }
  ) => Promise<void>
}

export interface AuthTestResult {
  /**
   * Stable identifier from the provider (workspace id, installation id, subdomain, etc).
   * Used for multi-instance uniqueness against (project_id, plugin_id, external_account_id).
   */
  externalAccountId: string
  /** Human-readable label shown in the UI ("acme.zendesk.com", "Sales Workspace"). */
  accountLabel: string
  /**
   * The credentials to persist. For OAuth2 this is usually { accessToken, refreshToken, expiresAt }.
   * For api_key this is usually a subset/projection of the submitted fields.
   */
  credentials: Credentials
  /** Optional settings to seed the connection with. */
  settings?: Settings
}

// ============================================================================
// Stream definition
// ============================================================================

export interface StreamInstanceRef {
  id: string
  label: string
  metadata?: Record<string, unknown>
}

export interface PluginListCtx {
  projectId: string
  connectionId: string
  credentials: Credentials
  settings: Settings
  fetch: typeof fetch
  logger: Logger
  signal: AbortSignal
}

export interface StreamDef<
  TSettings extends Settings = Settings,
  TFilters extends FilterConfig = FilterConfig
> {
  kind: StreamKind
  label: string
  description?: string
  /**
   * For parameterized streams (per-repo, per-database, per-channel), return the list
   * of available instances. Each selected instance gets its own `integration_streams` row
   * with `stream_id = '<streamKey>:<instance.id>'`.
   * If omitted, the stream is singleton.
   */
  instances?: (ctx: PluginListCtx) => Promise<StreamInstanceRef[]>
  /** Scheduled sync handler. */
  sync?: (ctx: SyncCtx<TSettings, TFilters>) => Promise<void>
  /**
   * Webhook handler. If present, the stream defaults to `frequency = 'webhook'`
   * (no polling). A stream can have both sync (backfill) + webhook (live).
   */
  webhook?: (ctx: WebhookCtx) => Promise<Response | void>
  /** Allowed frequencies for this stream. Defaults to ['manual','1h','6h','24h']. */
  frequencies?: SyncFrequency[]
  /** Zod schema for stream-specific filters (date ranges, status filters, etc). */
  filterSchema?: ZodSchema<TFilters>
  /** Zod schema for stream-specific settings (e.g. a channel's "join-on-mention" flag). */
  settingsSchema?: ZodSchema<TSettings>
  /** Default filter values. */
  defaultFilters?: TFilters
  /** Default settings values. */
  defaultSettings?: TSettings
}

// ============================================================================
// Sync context — the plugin's only view into the platform
// ============================================================================

export interface ProgressEvent {
  type: string
  message?: string
  current?: number
  total?: number
  externalId?: string
  hissunoId?: string
}

export interface SessionIngestInput {
  externalId: string
  source: string
  /** Session content type. See SessionType in @/types/session. */
  sessionType?: 'chat' | 'meeting' | 'behavioral'
  status?: 'active' | 'closed'
  name?: string
  description?: string
  userMetadata?: Record<string, unknown>
  firstMessageAt?: Date
  lastActivityAt?: Date
  createdAt?: Date
  messages: Array<{
    senderType: string
    content: string
    createdAt?: Date
  }>
  contactId?: string
  /** Optional email to resolve/upsert a contact before linking. */
  contactEmail?: string
  contactName?: string
}

export interface ContactIngestInput {
  externalId: string
  email: string
  name?: string
  phone?: string | null
  title?: string | null
  companyId?: string | null
  companyDomain?: string
  customFields?: Record<string, unknown>
  mergeStrategy?: 'fill_nulls' | 'overwrite' | 'never_overwrite'
}

export interface CompanyIngestInput {
  externalId: string
  domain: string
  name?: string
  industry?: string | null
  country?: string | null
  employeeCount?: number | null
  notes?: string | null
  customFields?: Record<string, unknown>
  mergeStrategy?: 'fill_nulls' | 'overwrite' | 'never_overwrite'
}

export interface IssueIngestInput {
  externalId: string
  name: string
  description: string
  type: 'bug' | 'feature_request' | 'change_request'
  status?: 'open' | 'ready' | 'in_progress' | 'resolved' | 'closed'
  priority?: 'low' | 'medium' | 'high'
  sessionId?: string
  productScopeId?: string | null
  customFields?: Record<string, unknown>
}

export interface KnowledgeIngestInput {
  externalId: string
  /** Matches knowledgeSources.type values used across the codebase. */
  type: string
  name?: string | null
  description?: string | null
  url?: string | null
  content?: string | null
  storagePath?: string | null
  analyzedContent?: string | null
  analysisScope?: string | null
  origin?: string | null
  parentId?: string | null
  notionPageId?: string | null
  sourceCodeId?: string | null
  customFields?: Record<string, unknown> | null
  enabled?: boolean
  productScopeId?: string | null
  skipInlineProcessing?: boolean
}

export interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void
  warn: (message: string, data?: Record<string, unknown>) => void
  error: (message: string, data?: Record<string, unknown>) => void
  debug: (message: string, data?: Record<string, unknown>) => void
}

export interface SyncCtx<
  TSettings extends Settings = Settings,
  TFilters extends FilterConfig = FilterConfig
> {
  // identity
  projectId: string
  connectionId: string
  /** Full stream key as persisted — for singleton streams this equals the stream def key.
   *  For parameterized streams this looks like 'codebase:acme/repo'. */
  streamId: string
  /** The stream definition key as declared in `definePlugin({ streams: { <here>: ... } })`. */
  streamKey: string
  /** For parameterized streams, the instance id portion (e.g. 'acme/repo'). Null otherwise. */
  instanceId: string | null

  // runtime
  credentials: Credentials
  settings: TSettings
  filters: TFilters
  syncMode: SyncMode
  triggeredBy: TriggerSource
  signal: AbortSignal
  logger: Logger

  /** When the connection was last successfully synced for this stream (incremental cursor). */
  lastSyncAt: Date | null

  // ingestion primitives — the only way a plugin writes data
  ingest: {
    session: (input: SessionIngestInput) => Promise<{ sessionId: string }>
    contact: (input: ContactIngestInput) => Promise<{ contactId: string }>
    company: (input: CompanyIngestInput) => Promise<{ companyId: string }>
    issue: (input: IssueIngestInput) => Promise<{ issueId: string }>
    knowledge: (input: KnowledgeIngestInput) => Promise<{ docId: string }>
  }

  // dedup helpers
  isSynced: (externalId: string) => Promise<boolean>
  getSyncedIds: () => Promise<Set<string>>
  recordSynced: (params: {
    externalId: string
    hissunoId: string
    kind: StreamKind
  }) => Promise<void>

  // progress emission (runtime adapts to SSE for manual triggers)
  progress: (event: ProgressEvent) => void

  // incremental save of OAuth refreshed tokens, etc
  saveCredentials: (credentials: Credentials) => Promise<void>
}

// ============================================================================
// Webhook context
// ============================================================================

export interface WebhookCtx {
  projectId: string
  connectionId: string
  streamId: string
  streamKey: string
  credentials: Credentials
  settings: Settings
  request: NextRequest
  logger: Logger

  ingest: SyncCtx['ingest']
  isSynced: SyncCtx['isSynced']
  recordSynced: SyncCtx['recordSynced']
  saveCredentials: SyncCtx['saveCredentials']
}

// ============================================================================
// Custom handler context
// ============================================================================

export interface PluginRouteCtx {
  projectId: string
  plugin: PluginDef
  /** Null when invoked on a route without a connection segment. */
  connectionId: string | null
  credentials: Credentials | null
  settings: Settings | null
  logger: Logger
}

// ============================================================================
// PluginDef — the object definePlugin returns
// ============================================================================

export interface ConfigDialogProps {
  pluginId: string
  projectId: string
  /** If set, the dialog opens in edit mode against this connection. */
  connectionId?: string
  open: boolean
  onClose: () => void
  onSuccess?: (connectionId: string) => void
}

export interface PluginIcon {
  src: string
  darkSrc?: string
  inlineSvg?: boolean
  invertInDark?: boolean
}

export interface PluginDef {
  id: string
  name: string
  description: string
  category:
    | 'interactive'
    | 'sessions'
    | 'issues'
    | 'knowledge'
    | 'analytics'
    | 'customer_data'
  icon: PluginIcon
  /** Coming-soon plugins render in the marketplace as disabled placeholders. */
  comingSoon?: boolean
  /**
   * If false, a project can only have one connection to this plugin.
   * Default true — a project can connect multiple accounts.
   */
  multiInstance?: boolean
  /** Label shown on the marketplace card (defaults to 'Connect' / 'Manage'). */
  setupLabel?: string

  auth: AuthSchema
  streams: Record<string, StreamDef>

  /**
   * For webhook plugins where the URL is static (can't include connectionId):
   * given the payload, resolve which connection this event belongs to.
   * Return null to reject the webhook with 404.
   */
  /**
   * Map an incoming webhook to a hissuno connection id. The plugin is
   * responsible for verifying request authenticity (signature, token, …)
   * before returning a connection id — the route trusts whatever this
   * returns and only then touches the database.
   *
   * Return value:
   *   - `string` — connection id; the route loads it and dispatches to
   *     the stream's webhook handler.
   *   - `Response` — the plugin fully handled the request (e.g. a setup
   *     challenge); the route returns this Response as-is.
   *   - `null` — unknown sender; the route responds 404.
   */
  resolveConnection?: (params: {
    payload: unknown
    rawBody: string
    request: NextRequest
  }) => Promise<string | Response | null>

  /**
   * React escape hatch. If defined, the marketplace opens this instead of the
   * generic config dialog. Must support both create mode (no connectionId) and
   * edit mode (connectionId provided).
   */
  ui?: {
    ConfigDialog?: LazyExoticComponent<ComponentType<ConfigDialogProps>>
  }

  /**
   * Custom per-plugin API handlers. Routed at:
   *   /api/(project)/plugins/[pluginId]/[handler]                  — no connection
   *   /api/(project)/plugins/[pluginId]/[connectionId]/[handler]   — connection bound
   *
   * The runtime picks the shape based on whether `connectionId` is in the path.
   */
  customHandlers?: Record<
    string,
    (req: NextRequest, ctx: PluginRouteCtx) => Promise<Response>
  >
}

// ============================================================================
// definePlugin — identity function that gives us typing without runtime cost
// ============================================================================

export function definePlugin(def: PluginDef): PluginDef {
  // Validate at module load time — catches typos early.
  if (!def.id || !/^[a-z][a-z0-9_-]*$/.test(def.id)) {
    throw new Error(
      `[plugin-kit] Invalid plugin id: ${JSON.stringify(def.id)}. Must match /^[a-z][a-z0-9_-]*$/`
    )
  }
  if (!def.streams || Object.keys(def.streams).length === 0) {
    throw new Error(
      `[plugin-kit] Plugin "${def.id}" has no streams. At least one is required.`
    )
  }
  for (const [key, stream] of Object.entries(def.streams)) {
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      throw new Error(
        `[plugin-kit] Plugin "${def.id}" has invalid stream key "${key}". Must match /^[a-z][a-z0-9_]*$/`
      )
    }
    if (!stream.sync && !stream.webhook) {
      throw new Error(
        `[plugin-kit] Plugin "${def.id}" stream "${key}" must define sync or webhook.`
      )
    }
  }
  return def
}

// ============================================================================
// Public helpers
// ============================================================================

export const DEFAULT_FREQUENCIES: SyncFrequency[] = ['manual', '1h', '6h', '24h']

export function buildStreamId(streamKey: string, instanceId: string | null): string {
  return instanceId == null ? streamKey : `${streamKey}:${instanceId}`
}

export function parseStreamId(streamId: string): { streamKey: string; instanceId: string | null } {
  const idx = streamId.indexOf(':')
  if (idx < 0) return { streamKey: streamId, instanceId: null }
  return { streamKey: streamId.slice(0, idx), instanceId: streamId.slice(idx + 1) }
}
