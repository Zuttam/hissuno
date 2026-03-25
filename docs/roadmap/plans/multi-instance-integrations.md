# Multi-Instance Integrations Per Project

## Context

Currently every integration connection table enforces a `UNIQUE` constraint on `project_id`, limiting each project to one connection per provider type. The entire stack (DB, API, lib, UI) assumes this 1:1 relationship. Users need multiple connections of the same type (e.g., two Fathom accounts, two Slack workspaces) to aggregate data from multiple sources.

Child tables (sync runs, synced data) already reference `connection_id` - so the data layer below connections already supports multi-instance. The constraint lives in 4 places: the DB unique constraint, the upsert-on-project_id pattern, projectId-only API lookups, and the frontend's type-as-key assumption.

## Scope

All 11 connection-based integrations (excludes Widget which stays single-per-project). Auto-naming from provider data (workspace name, subdomain, account login, etc.) with fallback to "Provider #N".

---

## Step 1: Database Schema Changes

**File: `app/src/lib/db/schema/app.ts`**

For each of these 11 tables, remove `.unique()` from `project_id` and add a `display_name` column:

- `slackWorkspaceTokens` (~line 544)
- `githubAppInstallations` (~line 598)
- `jiraConnections` (~line 621)
- `linearConnections` (~line 672)
- `zendeskConnections` (~line 722)
- `intercomConnections` (~line 778)
- `gongConnections` (~line 834)
- `posthogConnections` (~line 889)
- `notionConnections` (~line 931)
- `hubspotConnections` (~line 999)
- `fathomConnections` (~line 1070)

Change pattern:
```ts
// Before
project_id: uuid('project_id').notNull().unique().references(() => projects.id, { onDelete: 'cascade' }),

// After
project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
display_name: text('display_name'),
```

**File: `app/src/lib/db/schema/relations.ts`** (~lines 90-103)

Change project relations from `one()` to `many()` for all 11 integration types (keep `widgetIntegration` as `one()`):
```ts
// Before
fathomConnection: one(fathomConnections, { fields: [projects.id], references: [fathomConnections.project_id] }),
// After
fathomConnections: many(fathomConnections),
```

**File: `app/src/lib/db/queries/types.ts`** - No changes needed (types are inferred from schema).

**Generate migration:** `npx drizzle-kit generate` then `npx drizzle-kit push` for dev.

---

## Step 2: Integration Library Changes (all 11 providers)

**Files: `app/src/lib/integrations/[provider]/index.ts`** (11 files)

For each provider, apply these changes:

### 2a. Add `listConnections(projectId)` function
Returns all connections for a project as an array. Each item includes the connection `id`, `displayName`, and all existing status fields.

### 2b. Refactor `storeCredentials` - insert or update by connectionId
```ts
// Before: upsert on project_id
.onConflictDoUpdate({ target: xxxConnections.project_id, set: { ... } })

// After: if connectionId provided, UPDATE by id; otherwise INSERT new row
if (params.connectionId) {
  await db.update(xxxConnections).set({ ... }).where(eq(xxxConnections.id, params.connectionId))
} else {
  await db.insert(xxxConnections).values({ project_id: params.projectId, ... }).returning({ id: xxxConnections.id })
}
```

Add `displayName` parameter. For OAuth providers, auto-populate from provider data (workspace_name, hub_name, etc.). For token-based, leave null initially.

### 2c. Refactor lookup functions from projectId to connectionId
```ts
// Before
export async function getXxxCredentials(projectId: string)
// After
export async function getXxxCredentials(connectionId: string)
```

Functions affected per provider: `getCredentials`, `updateSettings`, `disconnect`, `updateSyncState`, `getSyncStats`.

WHERE clause changes from `eq(table.project_id, projectId)` to `eq(table.id, connectionId)`.

### 2d. Keep `hasXxxConnection(projectId)` for backwards compat
This function stays projectId-based but returns the first connection found (or not-connected status). Used by code paths that just need to know if any connection exists.

### 2e. Refactor sync functions to take connectionId
```ts
// Before
export async function syncXxxData(projectId: string, options)
// After
export async function syncXxxData(connectionId: string, options)
```

`getConnectionsDueForSync` already returns `{ id, projectId }` per row - no change needed.

---

## Step 3: API Route Changes (all 11 providers)

**Files: `app/src/app/api/(project)/integrations/[provider]/route.ts`** (11 files)

### 3a. GET - return connections array
```ts
// Before: returns single { connected, ... }
// After: returns { connections: [{ connectionId, displayName, connected, ... }] }
```

Accept optional `connectionId` query param. If provided, return single connection status. If not, return all connections for the project.

### 3b. DELETE - require connectionId
```ts
// Before: DELETE ?projectId=xxx
// After: DELETE ?projectId=xxx&connectionId=yyy
```

Verify connection belongs to the project before deleting.

### 3c. PATCH - require connectionId
Settings updates target a specific connection by `connectionId` in the body.

**Files: `app/src/app/api/(project)/integrations/[provider]/connect/route.ts`** (11 files)

### 3d. POST connect - support new + reconnect
- If body includes `connectionId`: update existing connection credentials
- If no `connectionId`: create new connection
- For OAuth: add optional `connectionId` to the state payload so callbacks can update existing connections

**Files: `app/src/app/api/(project)/integrations/[provider]/callback/route.ts`** (7 OAuth providers)

### 3e. OAuth callbacks - respect connectionId in state
Parse `connectionId` from the state payload. If present, update that connection. If absent, create new.

**Files: `app/src/app/api/(project)/integrations/[provider]/sync/route.ts`** (7 providers with sync)

### 3f. Sync - require connectionId
```ts
// Before: ?projectId=xxx
// After: ?projectId=xxx&connectionId=yyy
```

---

## Step 4: Frontend API Client

**File: `app/src/lib/api/integrations.ts`**

Add `connectionId` parameter to all fetch/action functions:
```ts
export function fetchFathomStatus(projectId: string, connectionId?: string): Promise<Response>
export function disconnectFathom(projectId: string, connectionId: string): Promise<Response>
export function fathomSyncUrl(projectId: string, connectionId: string, mode: string): string
```

---

## Step 5: Frontend UI Changes

### 5a. ConnectionInfo type
**File: `app/src/components/projects/integrations/connected-list.tsx`**

```ts
export interface ConnectionInfo {
  id: string              // DB UUID (the connection's actual id)
  type: string            // Provider type ('fathom', 'slack', etc.)
  name: string            // Display name (auto from provider data or "Provider #N")
  detail: string          // Provider-specific subtitle
  status: IntegrationStatus
  lastSyncAt: string | null
}
```

### 5b. ConnectedList - pass connectionId on click
```ts
// Before
onClick={() => onSelect(conn.type)}
// After
onClick={() => onSelect(conn.type, conn.id)}
```

Update `onSelect` signature: `(type: string, connectionId?: string) => void`

### 5c. Integrations page - handle multiple connections per type
**File: `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx`**

- `refreshConnections`: parse `connections` array from each provider response, push multiple `ConnectionInfo` entries per type
- `activeDialog` state: `{ type: string; connectionId?: string } | null`
- `connectedTypes`: stays as `Set<string>` (just tracks whether at least one connection of a type exists)
- `openDialog`: accept optional `connectionId`
- Dialog rendering: pass `connectionId` to each config dialog

### 5d. Marketplace - clicking opens "add new" flow
**File: `app/src/components/projects/integrations/marketplace.tsx`**

No structural changes needed. Clicking an already-connected type from marketplace opens the dialog without a `connectionId` (= "add new connection" mode).

### 5e. Config dialogs - support connectionId prop (11 dialogs)
**Files: `app/src/components/projects/integrations/[provider]-config-dialog.tsx`**

Each dialog gets an optional `connectionId` prop:
- If `connectionId` is set: fetch status for that specific connection, show edit/settings/disconnect UI
- If `connectionId` is absent: show the "connect new" form
- Disconnect targets the specific `connectionId`
- Sync targets the specific `connectionId`
- Auto-populate `displayName` from provider data on connect

### 5f. ConnectDropdown
**File: `app/src/components/projects/integrations/connect-dropdown.tsx`**

No changes - always opens dialog without connectionId (= "add new").

---

## Step 6: Display Name Auto-Population

Provider-specific display names (no user input needed):

| Provider | Auto-name source | Example |
|----------|-----------------|---------|
| Slack | `workspace_name` | "Acme Corp" |
| GitHub | `account_login` | "acme-corp" |
| Jira | `site_url` | "acme.atlassian.net" |
| Linear | `organization_name` | "Acme" |
| Zendesk | `subdomain` | "acme" |
| Intercom | `workspace_name` | "Acme" |
| Gong | `base_url` or "Gong #N" | "Gong #1" |
| PostHog | `host` or "PostHog #N" | "app.posthog.com" |
| Notion | `workspace_name` | "Acme Workspace" |
| HubSpot | `hub_name` | "Acme Inc" |
| Fathom | "Fathom #N" (no natural name) | "Fathom #1" |

The `display_name` column is populated at connect time from these provider fields. For providers without a natural name, use sequential numbering based on existing connection count.

---

## Implementation Order

1. Schema changes + migration (Step 1)
2. Integration libs (Step 2) - one provider at a time, starting with Fathom as reference implementation
3. API routes (Step 3) - matching the lib changes per provider
4. Frontend API client (Step 4)
5. Frontend UI (Step 5) - ConnectedList, page, then dialogs

---

## Verification

1. **Schema**: Run `npx drizzle-kit push` and verify migration applies cleanly
2. **Existing data**: Verify existing single connections still appear and work
3. **Add second connection**: Connect a second Fathom account, verify both appear in the connected list
4. **Sync**: Trigger sync on each connection independently, verify data goes to correct connection
5. **Disconnect**: Disconnect one of two connections, verify the other remains
6. **OAuth flow**: For an OAuth provider (e.g., Notion), connect two workspaces, verify both persist
