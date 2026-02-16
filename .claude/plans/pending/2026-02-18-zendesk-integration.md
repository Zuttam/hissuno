---
status: pending
created: 2026-02-18
impact: high
summary: Sync solved/closed Zendesk tickets as Hissuno sessions with contact enrichment, mirroring the Intercom integration pattern
---

# Plan: Zendesk Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sync solved/closed Zendesk tickets as Hissuno sessions with contact enrichment, mirroring the Intercom integration pattern.

**Architecture:** Pull-based sync using Zendesk REST API v2 with Basic Auth (email/token). Three DB tables (connections, synced_tickets, sync_runs) with RLS. Sync service fetches tickets, maps comments to session messages, enriches contacts from requester profiles. Cron job handles scheduled sync; SSE streaming provides real-time progress for manual sync.

**Tech Stack:** Next.js API routes, Supabase (PostgreSQL + RLS), Zendesk REST API v2, SSE streaming via `@/lib/sse`

**Reference implementation:** The Intercom integration at `app/src/lib/integrations/intercom/` is the 1:1 reference for all patterns. When in doubt, check how Intercom does it.

## Context

Hissuno already supports 6 session sources (widget, Slack, Intercom, Gong, API, manual). Zendesk is the next integration, following the proven Intercom pull-based sync pattern. Users authenticate via API token (subdomain + email + token), and we sync solved/closed tickets as closed sessions.

## Design

### Database Schema

Three tables mirroring the Intercom pattern:

**`zendesk_connections`** — One per project, stores credentials + sync config

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `project_id` | uuid UNIQUE FK | One connection per project |
| `subdomain` | text | e.g. `mycompany` (from `mycompany.zendesk.com`) |
| `admin_email` | text | Email of the Zendesk admin who created the token |
| `api_token` | text | Zendesk API token |
| `account_name` | text | Display name fetched from `/users/me` |
| `sync_frequency` | text | `'manual' \| '1h' \| '6h' \| '24h'` |
| `sync_enabled` | boolean | |
| `filter_config` | jsonb | `{ fromDate, toDate }` |
| `last_sync_at`, `last_sync_status`, `last_sync_error`, `last_sync_tickets_count`, `next_sync_at` | | Sync state tracking |

**`zendesk_synced_tickets`** — Dedup tracking

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `connection_id` | uuid FK | |
| `zendesk_ticket_id` | bigint | Zendesk ticket IDs are integers |
| `session_id` | text FK→sessions | |
| `ticket_created_at`, `ticket_updated_at` | timestamptz | |
| `comments_count` | integer | |
| UNIQUE(`connection_id`, `zendesk_ticket_id`) | | |

**`zendesk_sync_runs`** — Audit trail (same shape as `intercom_sync_runs` but `tickets_*` instead of `conversations_*`)

RLS: Same join-through-projects pattern as Intercom.

### Zendesk API Client

Auth: Basic Auth with `{email}/token:{api_token}` (base64 encoded). Base URL: `https://{subdomain}.zendesk.com/api/v2`.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET /users/me` | Test connection + get account info |
| `GET /tickets?status=solved,closed` | List solved/closed tickets (cursor pagination) |
| `GET /tickets/{id}/comments` | Get all comments (messages) for a ticket |
| `GET /users/{id}` | Get requester profile for contact enrichment |
| `GET /organizations/{id}` | Get requester's org for company enrichment |

Rate limit: 700 req/min. Respect `Retry-After` headers.

### Data Mapping

| Zendesk | Hissuno |
|---------|---------|
| Ticket | Session (`source: 'zendesk'`, `session_type: 'chat'`, `status: 'closed'`) |
| Comment by requester | `session_message` role `user` |
| Comment by agent | `session_message` role `human_agent` |
| Comment by system/trigger | `session_message` role `system` |
| Ticket subject | Session name |
| Ticket tags, priority, group | `user_metadata.zendesk_tags`, `zendesk_priority`, `zendesk_group` |
| Requester | Contact (create/match by email) |
| Requester organization | Company (create/match by name) |

Session ID format: `zendesk-{ticketId}-{projectId}` (deterministic for idempotency). Private/internal comments (`public: false`) are skipped.

### Sync Flow

```
syncZendesk(supabase, projectId, options)
  1. Get credentials from zendesk_connections
  2. Create sync run record
  3. Update sync state -> 'in_progress'
  4. Fetch tickets (status=solved,closed + date filters, cursor pagination)
  5. For each ticket:
     a. Check if already synced (skip if so)
     b. Fetch ticket comments (paginated, skip private)
     c. Fetch requester profile + organization
     d. Create/match contact + company
     e. Create session with messages
     f. Record in zendesk_synced_tickets
     g. Emit progress event
  6. Update sync state -> 'success' / 'error'
  7. Complete sync run with stats
```

### File Structure

```
app/src/lib/integrations/zendesk/
  client.ts      # ZendeskClient class (API wrapper)
  index.ts       # DB operations (connections, sync state, CRUD)
  sync.ts        # Core sync logic

app/src/app/api/integrations/zendesk/
  route.ts           # GET (status) / PATCH (settings) / DELETE (disconnect)
  connect/route.ts   # POST - validate token + store credentials
  sync/route.ts      # GET - manual sync (SSE streaming)
  test/route.ts      # POST - test connection

app/src/app/api/cron/zendesk-sync/
  route.ts       # GET - scheduled sync

app/src/components/projects/edit-dialogs/
  zendesk-config-dialog.tsx
```

### UI

Config dialog with three states:
1. **Not connected**: Subdomain + email + API token form, test connection, connect
2. **Connected**: Status, sync frequency, date filters, sync now, disconnect
3. **Syncing**: Progress bar via SSE

Added as a card in the existing project settings integrations section.

### Error Handling

- **Rate limiting**: Retry with `Retry-After`, up to 3 retries per request, then skip ticket
- **HTML content**: Strip to plain text before storing
- **Private comments**: Skip (`public: false`)
- **Deleted tickets**: Session persists, incremental sync won't find it again
- **Token revocation**: 401 → error state with "Reconnect" prompt
- **Cron safety**: Skip `in_progress` connections, 10-min timeout per sync

---

## Implementation Tasks

### Task 1: Database Migration

**Files:**
- Create: `app/supabase/migrations/20260218000000_add_zendesk_integration.sql`

**Step 1: Write the migration**

Model on `app/supabase/migrations/20260126000000_add_intercom_integration.sql`. Create three tables:

`zendesk_connections`:
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE` + `UNIQUE(project_id)`
- `subdomain text NOT NULL`
- `admin_email text NOT NULL`
- `api_token text NOT NULL`
- `account_name text`
- `sync_frequency text NOT NULL DEFAULT 'manual' CHECK (sync_frequency IN ('manual', '1h', '6h', '24h'))`
- `sync_enabled boolean NOT NULL DEFAULT true`
- `filter_config jsonb DEFAULT '{}'`
- `last_sync_at timestamptz`, `last_sync_status text CHECK (... IN ('success', 'error', 'in_progress'))`, `last_sync_error text`, `last_sync_tickets_count integer DEFAULT 0`, `next_sync_at timestamptz`
- `created_at`, `updated_at` with `moddatetime` trigger

`zendesk_synced_tickets`:
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `connection_id uuid NOT NULL REFERENCES public.zendesk_connections(id) ON DELETE CASCADE`
- `zendesk_ticket_id bigint NOT NULL`
- `session_id text NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE`
- `ticket_created_at timestamptz`, `ticket_updated_at timestamptz`, `comments_count integer DEFAULT 0`
- `synced_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())`
- `UNIQUE(connection_id, zendesk_ticket_id)`

`zendesk_sync_runs`: Same shape as `intercom_sync_runs` but with `tickets_found`, `tickets_synced`, `tickets_skipped`.

Indexes: same pattern as Intercom. RLS: same join-through-projects pattern.

**Step 2: Push migration**

Run: `cd app/supabase && supabase db push`

**Step 3: Regenerate types**

Run: `cd app/supabase && supabase gen types typescript --local > ../src/types/supabase.ts`

**Step 4: Commit**

```
git add app/supabase/migrations/20260218000000_add_zendesk_integration.sql app/src/types/supabase.ts
git commit -m "feat(zendesk): add database migration for Zendesk integration tables"
```

---

### Task 2: Add `'zendesk'` to Session Types

**Files:**
- Modify: `app/src/types/session.ts`

**Step 1:** Add `'zendesk'` to `SessionSource` union (line 9).

**Step 2:** Add `zendesk: { label: 'Zendesk', variant: 'success' }` to `SESSION_SOURCE_INFO` (after intercom entry).

**Step 3:** Run: `cd app && npx tsc --noEmit` — expected: no type errors.

**Step 4: Commit**

```
git add app/src/types/session.ts
git commit -m "feat(zendesk): add zendesk to SessionSource type"
```

---

### Task 3: Zendesk API Client

**Files:**
- Create: `app/src/lib/integrations/zendesk/client.ts`

Model on `app/src/lib/integrations/intercom/client.ts`. Key differences:

- Auth: Basic Auth with `{email}/token:{apiToken}` base64 encoded (NOT Bearer token)
- Base URL: `https://{subdomain}.zendesk.com/api/v2`
- Pagination: Cursor-based (`page[after]` / `meta.after_cursor` / `meta.has_more`)

Classes: `ZendeskApiError`, `ZendeskRateLimitError`

Interfaces: `ZendeskUser`, `ZendeskOrganization`, `ZendeskTicket`, `ZendeskComment`, `ZendeskPaginatedResponse<T>`

`ZendeskClient` class methods:
- Constructor: `(subdomain, email, apiToken)`
- `testConnection()` → `GET /users/me`
- `async *listTickets(options)` → cursor-paginated ticket iteration
- `getTicketComments(ticketId)` → all comments paginated
- `getUser(userId)` → user profile
- `getOrganization(orgId)` → org details

**Commit:** `feat(zendesk): add Zendesk API client with typed methods`

---

### Task 4: Zendesk DB Operations Service

**Files:**
- Create: `app/src/lib/integrations/zendesk/index.ts`

Mirror `app/src/lib/integrations/intercom/index.ts` exactly, replacing Intercom names with Zendesk equivalents.

Exports: `ZendeskSyncFrequency`, `ZendeskFilterConfig`, `ZendeskConnection`, `ZendeskIntegrationStatus`, `hasZendeskConnection`, `getZendeskCredentials`, `storeZendeskCredentials`, `updateZendeskSettings`, `disconnectZendesk`, `clearSyncedTickets`, `isTicketSynced`, `recordSyncedTicket`, `updateSyncState`, `createSyncRun`, `completeSyncRun`, `getConnectionsDueForSync`, `getSyncStats`

Table names: `zendesk_connections`, `zendesk_synced_tickets`, `zendesk_sync_runs`. Column: `zendesk_ticket_id` (bigint). Logging prefix: `[zendesk.*]`.

**Commit:** `feat(zendesk): add Zendesk DB operations service layer`

---

### Task 5: Zendesk Sync Service

**Files:**
- Create: `app/src/lib/integrations/zendesk/sync.ts`

Mirror `app/src/lib/integrations/intercom/sync.ts`. Key differences:

Types: `SyncProgressEvent` (with `ticketId`), `SyncResult` (`ticketsFound/Synced/Skipped`), `SyncMode`, `SyncOptions`

Helper functions:
- `mapAuthorToSenderType(authorId, requesterId)`: requester → `'user'`, others → `'human_agent'`
- `generateSessionId(ticketId, projectId)`: `zendesk-{ticketId}-{projectId}`
- `stripHtml(html)`: `html.replace(/<[^>]*>/g, '').trim()`
- `buildUserMetadata(ticket, user, organization)`: zendesk_ticket_id, zendesk_tags, zendesk_priority, zendesk_group_id, name, email, phone, company, custom fields
- `enrichContact(supabase, projectId, user, organization)`: find/create contact by email, find/create company by org name, link them, return contactId
- `createSessionFromTicket(supabase, zendesk, projectId, connectionId, ticket)`: fetch comments (skip private), fetch requester + org, enrich contact, create session + messages, record synced ticket

Main: `syncZendeskTickets(supabase, projectId, options)`: same flow as Intercom (credentials → sync run → iterate tickets → batch process → update state)

**Commit:** `feat(zendesk): add sync service with contact enrichment`

---

### Task 6: API Routes - Test Connection

**Files:**
- Create: `app/src/app/api/integrations/zendesk/test/route.ts`

Mirror `app/src/app/api/integrations/intercom/test/route.ts`.

`POST /api/integrations/zendesk/test`: body `{ subdomain, email, apiToken }`, validate, test connection, return `{ success, accountName }` or error.

**Commit:** `feat(zendesk): add test connection API route`

---

### Task 7: API Routes - Connect

**Files:**
- Create: `app/src/app/api/integrations/zendesk/connect/route.ts`

POST only (no OAuth GET). Mirror Intercom POST handler.

`POST /api/integrations/zendesk/connect`: body `{ projectId, subdomain, email, apiToken, syncFrequency, filterConfig? }`, auth via `resolveUserAndProject`, test connection, store credentials, return `{ success, accountName }`.

**Commit:** `feat(zendesk): add connect API route`

---

### Task 8: API Routes - Status / Settings / Disconnect

**Files:**
- Create: `app/src/app/api/integrations/zendesk/route.ts`

Mirror `app/src/app/api/integrations/intercom/route.ts`:
- `GET ?projectId=xxx` → status + stats
- `PATCH` → update settings
- `DELETE ?projectId=xxx` → disconnect

**Commit:** `feat(zendesk): add status/settings/disconnect API routes`

---

### Task 9: API Routes - Manual Sync (SSE)

**Files:**
- Create: `app/src/app/api/integrations/zendesk/sync/route.ts`

Mirror `app/src/app/api/integrations/intercom/sync/route.ts`.

`GET ?projectId=xxx&mode=incremental|full`: auth, verify connected, `createSSEStreamWithExecutor` with `syncZendeskTickets()` + progress callback + AbortController.

**Commit:** `feat(zendesk): add manual sync SSE streaming route`

---

### Task 10: Cron Job - Scheduled Sync

**Files:**
- Create: `app/src/app/api/cron/zendesk-sync/route.ts`

Mirror `app/src/app/api/cron/intercom-sync/route.ts`. `createAdminClient()`, `getConnectionsDueForSync()`, loop with `syncZendeskTickets()`, `maxDuration = 300`.

**Commit:** `feat(zendesk): add scheduled sync cron job`

---

### Task 11: Config Dialog UI

**Files:**
- Create: `app/src/components/projects/edit-dialogs/zendesk-config-dialog.tsx`

Mirror `app/src/components/projects/edit-dialogs/intercom-config-dialog.tsx`. Key difference: connect form has three fields (subdomain, email, API token) instead of one. Three states: not connected, connected, syncing. Uses `Dialog`, `Button`, `Alert`, `Spinner`, `ToggleGroup` from `@/components/ui`.

**Commit:** `feat(zendesk): add configuration dialog component`

---

### Task 12: Wire Up Zendesk in Project Settings

**Files:**
- Modify: The integrations settings page (search for `IntercomConfigDialog` import)

Add Zendesk card alongside existing integration cards. Import and render `ZendeskConfigDialog`.

**Commit:** `feat(zendesk): wire up Zendesk integration card in project settings`

---

### Task 13: Build Verification & Cleanup

1. Run type check: `cd app && npx tsc --noEmit`
2. Run linter: `cd app && npm run lint`
3. Run tests: `cd app && npm run test`
4. Fix any issues and commit: `fix(zendesk): address build/lint issues`
