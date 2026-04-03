# Audit Trail

## Context

Identity is resolved on every request but never persisted. There's no audit log, and most tables lack `created_by`/`updated_by`. We need traceability: which identity performed what action on which resource.

---

## Design

### Table: `audit_events`

Append-only event log.

```
audit_events
  id              uuid PK
  project_id      uuid FK -> projects (nullable for account-level actions)

  -- Actor
  actor_type      text NOT NULL   -- 'user' | 'api_key' | 'system'
  actor_id        text NOT NULL   -- userId, keyId, or 'system'
  actor_user_id   uuid            -- the underlying user (null for system/cron)

  -- Action
  action          text NOT NULL   -- 'create' | 'read' | 'update' | 'delete' | 'archive' | 'import' | 'connect' | 'disconnect' | 'sync' | 'analyze' | 'invite' | 'revoke'

  -- Resource
  resource_type   text NOT NULL   -- 'contact' | 'company' | 'session' | 'issue' | ...
  resource_id     text            -- the specific resource ID; null for list/bulk ops

  -- Grouping
  operation_id    uuid            -- groups related events in a batch mutation

  -- Details (lean - just enough to trace, not full records)
  metadata        jsonb           -- see Metadata Guidelines below

  created_at      timestamp NOT NULL DEFAULT now()
```

**Indexes:**
- `(project_id, created_at)` - project activity feed
- `(actor_type, actor_id, created_at)` - "what did user/key X do?"
- `(resource_type, resource_id, created_at)` WHERE resource_id IS NOT NULL - "who touched resource Y?"
- `(operation_id)` WHERE operation_id IS NOT NULL - batch grouping

### Metadata Guidelines

Metadata is **lean traceability info**, not record dumps:

| Action | metadata |
|--------|----------|
| `create` | `{ "name": "Acme Corp" }` - just the identifying field(s) |
| `update` | `{ "fields": ["status", "priority"] }` - which fields changed, not old/new values |
| `delete` | `{ "name": "Old Contact" }` - identifying info of what was removed |
| `read` (single) | `{}` or omitted |
| `read` (list) | `{ "count": 50, "filters": { "status": "active" } }` - single row, result count + filters used |
| `archive` | `{ "archived": true }` |
| `import` | `{ "count": 200, "source": "csv" }` - single row for the whole import |
| `connect` | `{ "integration": "slack", "workspace": "acme" }` |
| `sync` | `{ "integration": "hubspot", "synced": 45 }` |

**Rule: One operation = one audit row.** A list endpoint returning 50 contacts is a single `read` event with `count: 50`. A batch archive of 20 sessions uses `operation_id` to group 20 individual `archive` events (since each resource mutation is distinct).

### Configuration

Add to `projectSettings` (existing jsonb or new column):
```
audit_config jsonb DEFAULT '{ "track_reads": false }'
```

- Mutations: always tracked
- Reads: configurable per project, default OFF

---

## Implementation

### 1. Schema (`app/src/lib/db/schema/app.ts`)

Add `auditEvents` table definition. Add relation in `relations.ts`.

### 2. Audit Utility (`app/src/lib/audit/audit.ts` - new file)

```typescript
type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'archive'
  | 'import' | 'connect' | 'disconnect' | 'sync' | 'analyze' | 'invite' | 'revoke'

type ResourceType = 'contact' | 'company' | 'session' | 'issue'
  | 'knowledge_source' | 'knowledge_package' | 'api_key' | 'member'
  | 'integration' | 'product_scope' | 'project' | 'custom_field'
  | 'relationship' | 'widget'

interface AuditEventInput {
  projectId: string | null
  identity: RequestIdentity
  action: AuditAction
  resourceType: ResourceType
  resourceId?: string           // null for list/bulk reads
  operationId?: string          // for batch mutations
  metadata?: Record<string, unknown>  // lean traceability info
}

// Fire-and-forget: never blocks the caller, never throws
export function logAuditEvent(input: AuditEventInput): void

// For batch mutations
export function createOperationId(): string
```

Internally:
- Resolves `actor_type`, `actor_id`, `actor_user_id` from `RequestIdentity`
- For read actions, checks project's `audit_config.track_reads` before inserting
- Inserts async (fire-and-forget), catches and logs errors silently

### 3. Service Context (`app/src/lib/audit/service-context.ts` - new file)

Threads identity + audit through the service layer:

```typescript
export interface ServiceContext {
  db: typeof db
  identity: RequestIdentity
  projectId: string
  audit: (action, resourceType, opts?) => void  // convenience wrapper
}

export function createServiceContext(
  identity: RequestIdentity,
  projectId: string
): ServiceContext
```

### 4. Wire Into Existing Services

**`app/src/lib/customers/customers-service.ts`** - add `ctx: ServiceContext` param:
- `createContact(ctx, data)` -> `ctx.audit('create', 'contact', { resourceId, metadata: { name } })`
- `updateContact(ctx, id, data)` -> `ctx.audit('update', 'contact', { resourceId, metadata: { fields: Object.keys(data) } })`
- Same for company operations

**`app/src/lib/issues/issues-service.ts`** - same pattern:
- `createIssue(ctx, data)` -> `ctx.audit('create', 'issue', ...)`
- `updateIssue(ctx, id, data)` -> `ctx.audit('update', 'issue', ...)`

### 5. Wire Into Route Handlers

For routes that don't go through a service layer (direct query calls), add audit at the route level:

```typescript
// Example: GET /api/contacts (list)
const identity = await requireRequestIdentity()
await assertProjectAccess(identity, projectId)
const ctx = createServiceContext(identity, projectId)
const result = await listContacts(projectId, filters)
ctx.audit('read', 'contact', { metadata: { count: result.total, filters } })
```

For batch mutations:
```typescript
const opId = createOperationId()
for (const id of sessionIds) {
  await updateSessionArchiveStatus(id, true)
  ctx.audit('archive', 'session', { resourceId: id, operationId: opId })
}
```

### 6. Rollout Order

**Phase A** - Infrastructure + core services:
1. Schema + migration
2. `audit.ts` utility
3. `service-context.ts`
4. Wire `customers-service.ts` (contact/company CRUD)
5. Wire `issues-service.ts` (issue CRUD)

**Phase B** - Routes with direct query calls:
- Session CRUD + archive
- Knowledge source/package CRUD
- Product scope CRUD
- Entity relationships

**Phase C** - Access control mutations:
- Member invite/update/remove
- API key create/revoke
- Project create/update/delete

**Phase D** - Integrations:
- Connect/disconnect
- Sync triggers

**Phase E** - Reads (once configurable tracking is wired):
- List/get on all resources

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `app/src/lib/db/schema/app.ts` | Add `auditEvents` table |
| `app/src/lib/db/schema/relations.ts` | Add audit relations |
| `app/src/lib/audit/audit.ts` | **New** - audit utility, types, `logAuditEvent()` |
| `app/src/lib/audit/service-context.ts` | **New** - `ServiceContext` + `createServiceContext()` |
| `app/src/lib/customers/customers-service.ts` | Add `ServiceContext` param, audit calls |
| `app/src/lib/issues/issues-service.ts` | Add `ServiceContext` param, audit calls |
| Route handlers calling updated services | Pass `ServiceContext` instead of raw params |
| Route handlers with direct queries (sessions, knowledge, etc.) | Add audit calls at route level |

## Verification

1. Create a contact via API -> verify `audit_events` row: `action=create, resource_type=contact, resource_id=<uuid>, actor_type=user`
2. List contacts -> verify single `audit_events` row: `action=read, resource_id=null, metadata.count=N`
3. Batch archive sessions -> verify events share `operation_id`, one row per session
4. Disable `track_reads` -> verify read events stop appearing
5. Audit insert failure -> verify mutation still succeeds (fire-and-forget)
6. Check existing tests still pass (no regressions in service function signatures)
