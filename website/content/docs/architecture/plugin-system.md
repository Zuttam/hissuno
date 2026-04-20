---
title: "Plugin System (Integrations)"
description: "How Hissuno integrations are built. Every provider is a plugin that declares its metadata, auth schema, and data streams - shared infrastructure handles everything else."
---

## Overview

Every Hissuno integration - Slack, GitHub, Linear, Zendesk, Intercom, and the rest - is a **plugin** built on the same unified plugin kit. A plugin is a single object produced by `definePlugin({...})` that declares:

- **Metadata** - id, name, icon, category
- **Auth schema** - how users connect this provider
- **Streams** - what data flows in (sessions, contacts, issues, knowledge, analytics)
- **Optional UI escape hatch** - a custom React dialog for complex setup flows
- **Optional custom API handlers** - provider-specific endpoints (e.g. "list Linear teams")

Plugin authors never touch database schema, API routes, cron jobs, or UI chrome. All of that is shared infrastructure that looks up the plugin by id and delegates to it.

## Anatomy of a Plugin

A plugin lives in a single file at `app/src/lib/integrations/plugins/<id>.ts` and is registered by adding it to the array in `app/src/lib/integrations/registry.ts`.

```typescript
import { definePlugin } from '../plugin-kit'

export const myPlugin = definePlugin({
  id: 'my-plugin',
  name: 'My Plugin',
  description: 'Sync widgets from MyService as sessions.',
  category: 'sessions',
  icon: { src: '/logos/my-plugin.svg' },
  multiInstance: true,

  auth: {
    type: 'api_key',
    fields: [
      { id: 'apiKey', label: 'API Key', secret: true, required: true },
    ],
    test: async (credentials, ctx) => {
      // Validate credentials against the provider. Throw on failure.
      return {
        externalAccountId: 'workspace-id',
        accountLabel: 'Acme Workspace',
        credentials: { apiKey: credentials.apiKey },
      }
    },
  },

  streams: {
    widgets: {
      kind: 'sessions',
      label: 'Widgets',
      sync: async (ctx) => {
        // Pull data from the provider and call ctx.ingest.session(...)
      },
    },
  },
})
```

### Required Fields

Every plugin declares:

| Field | Purpose |
|-------|---------|
| `id` | Stable identifier, lowercase with hyphens or underscores. Used in URLs and the registry. |
| `name` | Display name shown in the marketplace. |
| `description` | One-line summary. |
| `category` | One of `interactive`, `sessions`, `issues`, `knowledge`, `analytics`, `customer_data`. Controls marketplace grouping. |
| `icon` | Logo shown on cards. `{ src, darkSrc?, invertInDark?, inlineSvg? }`. |
| `auth` | Auth schema (see below). |
| `streams` | A record of stream definitions (see below). |

### Optional Fields

| Field | Purpose |
|-------|---------|
| `multiInstance` | If `true` (default), a project can connect multiple accounts to this plugin. Set to `false` for singleton plugins. |
| `comingSoon` | Renders the card as disabled in the marketplace. |
| `setupLabel` | Override the button label on the marketplace card. |
| `resolveConnection` | Maps an incoming webhook to a connection id (see Webhooks below). |
| `ui.ConfigDialog` | A lazy-loaded React component replacing the generic config dialog. |
| `customHandlers` | Per-plugin API endpoints (see Custom Handlers below). |

## Auth Schemas

The plugin kit supports four auth patterns. The shared `/api/plugins/[pluginId]/connect` route dispatches on `auth.type`.

### `api_key`

For tokens, shared secrets, or any manual-entry credentials.

```typescript
auth: {
  type: 'api_key',
  fields: [
    { id: 'subdomain', label: 'Subdomain', placeholder: 'acme', required: true },
    { id: 'email', label: 'Admin Email', required: true },
    { id: 'apiToken', label: 'API Token', secret: true, required: true },
  ],
  test: async (credentials, ctx) => {
    // Call the provider to verify. Return the external account id + label + credentials to persist.
    return {
      externalAccountId: credentials.subdomain,
      accountLabel: `${credentials.subdomain}.zendesk.com`,
      credentials: { ...credentials },
    }
  },
}
```

The `test` callback runs server-side on connect. Throw any error and the UI surfaces the message.

### `oauth2`

Standard OAuth 2.0 authorization-code flow. Hissuno handles the authorize redirect, token exchange, and refresh.

```typescript
auth: {
  type: 'oauth2',
  scopes: ['read', 'write'],
  authorizeUrl: 'https://provider.com/oauth/authorize',
  tokenUrl: 'https://api.provider.com/oauth/token',
  clientIdEnv: 'MY_PROVIDER_CLIENT_ID',
  clientSecretEnv: 'MY_PROVIDER_CLIENT_SECRET',
  onTokenExchanged: async (tokens, ctx) => {
    // Typically: call /me to get account id + label.
    return {
      externalAccountId: org.id,
      accountLabel: org.name,
      credentials: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt?.toISOString(),
      },
    }
  },
  refresh: async (credentials, ctx) => {
    // Optional. If absent, the runtime refreshes via standard grant_type=refresh_token.
  },
}
```

The callback arrives at `/api/plugins/oauth/[pluginId]/callback` and runs `onTokenExchanged`.

### `github_app`

Special case for the GitHub App installation flow. The plugin receives the `installationId` returned by GitHub and resolves it to an account.

```typescript
auth: {
  type: 'github_app',
  onInstallation: async (installationId, ctx) => { ... },
}
```

### `custom`

Escape hatch for anything non-standard - Slack's `oauth.v2.access`, bespoke signed flows, multi-step wizards. The plugin owns the full request/response cycle of `POST /api/plugins/[pluginId]/connect`.

```typescript
auth: {
  type: 'custom',
  connect: async (req, ctx) => {
    // Handle the connect request directly.
    // Call ctx.saveConnection(...) on success.
    return NextResponse.json({ connectionId: result.connectionId })
  },
}
```

## Streams

A **stream** is a single pipeline of data flowing from the provider into Hissuno. A plugin can declare many streams - for example, GitHub has both `feedback` (issues as sessions) and `codebase` (repo content as knowledge).

```typescript
streams: {
  meetings: {
    kind: 'sessions',
    label: 'Meetings',
    description: 'Recorded meetings with transcripts.',
    frequencies: ['manual', '1h', '6h', '24h'],
    filterSchema: z.object({ fromDate: z.string().optional() }),
    defaultFilters: {},
    sync: async (ctx) => { ... },
  },
}
```

### Stream Kinds

Each stream declares what kind of resource it ingests. The kind controls which ingest primitive it should call.

| Kind | Ingest via |
|------|------------|
| `sessions` | `ctx.ingest.session(...)` |
| `contacts` | `ctx.ingest.contact(...)` |
| `companies` | `ctx.ingest.company(...)` |
| `issues` | `ctx.ingest.issue(...)` |
| `knowledge` | `ctx.ingest.knowledge(...)` |
| `analytics` | Provider-specific (e.g. PostHog event definitions) |

### Singleton vs Parameterized Streams

A stream is **singleton** by default - one sync per connection. To split data across multiple instances (one per repo, one per channel, one per Linear team), add an `instances()` callback:

```typescript
issues: {
  kind: 'issues',
  instances: async (ctx) => {
    const teams = await listTeams(ctx.credentials)
    return teams.map((t) => ({ id: t.id, label: t.name }))
  },
  sync: async (ctx) => {
    // ctx.instanceId is set per instance.
  },
}
```

Each selected instance gets its own `integration_streams` row with `stream_id = '<streamKey>:<instance.id>'`, its own sync cadence, and its own cursor.

### Sync vs Webhook Streams

A stream can define a `sync` handler for scheduled polling, a `webhook` handler for live events, or both (backfill + live). When only `webhook` is defined, the stream defaults to `frequency = 'webhook'` with no polling.

### Filters and Settings

Both are optional Zod schemas:

- **filters** - per-sync filters the user configures (date ranges, status, labels). Surface as form fields and passed to `sync` as `ctx.filters`.
- **settings** - per-instance settings (a channel's "join on mention" flag, a stream's label-to-tag map). Passed as `ctx.settings`.

## The Sync Context

The `sync` handler receives a `SyncCtx` - the plugin's only view into the platform:

```typescript
sync: async (ctx: SyncCtx<MySettings, MyFilters>) => {
  ctx.credentials   // persisted credentials (refreshed OAuth tokens, etc)
  ctx.settings      // validated stream settings
  ctx.filters       // validated stream filters
  ctx.lastSyncAt    // incremental cursor
  ctx.syncMode      // 'incremental' | 'full'
  ctx.triggeredBy   // 'manual' | 'cron' | 'webhook'
  ctx.signal        // AbortSignal for cancellation
  ctx.logger        // structured logger

  // Ingestion primitives - the only way a plugin writes data.
  await ctx.ingest.session({ ... })
  await ctx.ingest.contact({ ... })
  await ctx.ingest.company({ ... })
  await ctx.ingest.issue({ ... })
  await ctx.ingest.knowledge({ ... })

  // Deduplication helpers.
  if (await ctx.isSynced(externalId)) continue
  const synced = await ctx.getSyncedIds()

  // Progress emission (streams to SSE for manual triggers).
  ctx.progress({ type: 'synced', externalId, hissunoId, message: '...' })

  // Persist refreshed credentials mid-sync.
  await ctx.saveCredentials(nextCredentials)
}
```

Plugins never write to the database directly. Every persisted row flows through `ctx.ingest.*`, which handles classification, embedding, deduplication, and graph evaluation.

## Webhooks

Plugins with live events define a `webhook` handler on the stream and, if the provider sends all events to a single URL (GitHub, Jira, Slack), a top-level `resolveConnection` callback on the plugin.

```typescript
resolveConnection: async ({ payload, rawBody, request }) => {
  // 1. Verify signature against the raw body. Return null on mismatch.
  if (!verifySignature(rawBody, request.headers)) return null

  // 2. Handle setup challenges by returning a Response directly.
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // 3. Resolve which connection this event belongs to.
  const connection = await findConnectionByExternalId('my-plugin', payload.team_id)
  return connection?.id ?? null
}
```

The webhook route at `/api/plugins/webhook/[pluginId]` runs `resolveConnection` first. Only if it returns a connection id does the route load credentials and dispatch to the stream's webhook handler. Unknown senders get a 404; unverified payloads never touch the database.

For connection-scoped webhook URLs, use `/api/plugins/webhook/[pluginId]/[connectionId]` instead - the connection is resolved from the path and `resolveConnection` is skipped.

## Custom Handlers

Any provider-specific endpoint beyond connect/sync/webhook is defined as a custom handler:

```typescript
customHandlers: {
  teams: async (req, ctx) => {
    // GET /api/plugins/[pluginId]/[connectionId]/teams
    const teams = await listTeams(ctx.credentials)
    return NextResponse.json({ teams })
  },
}
```

Custom handlers are routed at:

- `/api/plugins/[pluginId]/[handler]` - plugin-level, no connection
- `/api/plugins/[pluginId]/[connectionId]/[handler]` - connection-scoped, credentials pre-loaded

The runtime picks the shape based on whether `connectionId` is in the path.

## UI Escape Hatch

If the default config dialog is not enough, provide a custom React component:

```typescript
ui: {
  ConfigDialog: lazy(() => import('./my-plugin-dialog')),
}
```

The component receives `{ pluginId, projectId, connectionId?, open, onClose, onSuccess? }` and must support both create mode (no `connectionId`) and edit mode. This is an escape hatch - prefer the auto-generated dialog when the standard flow fits.

## Registering a Plugin

After writing the plugin file, add it to the registry:

```typescript
// app/src/lib/integrations/registry.ts
import { myPlugin } from './plugins/my-plugin'

const ALL_PLUGINS: PluginDef[] = [
  // ...existing plugins
  myPlugin,
]
```

The registry is the only place plugins are enumerated. Routes, cron, and the marketplace UI all derive from it.

## Built-in Plugins

Hissuno ships with the following plugins out of the box:

| Plugin | Auth | Streams | Docs |
|--------|------|---------|------|
| [Slack](/docs/integrations/slack) | custom | events (webhook) | Capture threads as sessions and respond as the bot. |
| [GitHub](/docs/integrations/github) | github_app | feedback, codebase | Sync issues and analyze repository content as knowledge. |
| [Linear](/docs/integrations/linear) | oauth2 | issues (per team) | Pull issues from Linear teams into Hissuno. |
| [Jira](/docs/integrations/jira) | oauth2 | issues | Sync issues from Jira projects. |
| [Intercom](/docs/integrations/intercom) | oauth2 | conversations | Import Intercom conversations as sessions. |
| [Zendesk](/docs/integrations/zendesk) | api_key | tickets | Import solved and closed tickets as sessions. |
| [Notion](/docs/integrations/notion) | oauth2 | knowledge, issues | Sync Notion pages as knowledge and databases as issues. |
| [HubSpot](/docs/integrations/hubspot) | oauth2 | contacts, companies | Sync CRM contacts and companies. |
| [Gong](/docs/integrations/gong) | api_key | calls | Import Gong call transcripts as sessions. |
| [Fathom](/docs/integrations/fathom) | api_key | meetings | Sync Fathom meetings as sessions with transcripts. |
| [PostHog](/docs/integrations/posthog) | api_key | analytics | Pull event definitions and behavioral analytics. |

For OAuth and GitHub App integrations on self-hosted instances, see [Self-Hosting Integration Setup](/docs/integrations/self-hosting-setup) for the environment variables each plugin expects.

## File Layout

```
app/src/lib/integrations/
  plugin-kit.ts          # PluginDef types + definePlugin()
  registry.ts            # the list of all plugins
  plugins/
    fathom.ts            # one file per plugin
    github.ts
    linear.ts
    slack.ts
    ...
  shared/                # runtime: ingestion, dedup, connections, oauth helpers
  <provider>/            # provider-specific clients (GitHub JWT, Fathom client, ...)
```

A plugin's *definition* lives in `plugins/<id>.ts`. Provider-specific HTTP clients, sync helpers, and webhook parsers live in `<provider>/` siblings - they are implementation detail the plugin imports.
