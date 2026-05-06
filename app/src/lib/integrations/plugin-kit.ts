/**
 * Plugin kit: the contract every integration plugin implements.
 *
 * In the skill-driven sync model, plugins are responsible for ONE thing:
 * authenticating a project against an external provider and producing an
 * `integration_connections` row. All sync logic lives in automation skills
 * under `src/lib/automations/skills/<plugin>-<stream>/`.
 *
 * A plugin is a single `PluginDef` object produced by `definePlugin(...)`.
 * It declares:
 *   - metadata (id, name, icon, category)
 *   - auth schema (how users connect this integration)
 *   - optional UI escape hatch (custom React dialog for complex flows)
 *   - optional custom API handlers (for OAuth callbacks, helper queries, etc.)
 *   - optional webhook resolver (maps incoming webhook payloads to a connection
 *     id; the route then fires an event-triggered automation)
 *
 * Plugin authors never touch DB schema, API routes, cron, or UI chrome.
 */

import type { NextRequest } from 'next/server'
import type { LazyExoticComponent, ComponentType } from 'react'

// ============================================================================
// Shared primitives
// ============================================================================

export type Credentials = Record<string, unknown>
export type Settings = Record<string, unknown>

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
   * the credential resolver POSTs to tokenUrl with grant_type=refresh_token.
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
// Logger
// ============================================================================

export interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void
  warn: (message: string, data?: Record<string, unknown>) => void
  error: (message: string, data?: Record<string, unknown>) => void
  debug: (message: string, data?: Record<string, unknown>) => void
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

  /**
   * Map an incoming webhook to a hissuno connection id. The plugin verifies
   * request authenticity (signature, token, …) before returning a connection
   * id — the webhook route trusts whatever this returns.
   *
   * Return value:
   *   - `string` — connection id; the route fires an event-triggered automation
   *     scoped to that connection's project.
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
  return def
}
