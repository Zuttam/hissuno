# Plan: Import Issues from Jira/Linear into Hissuno

## Context

Hissuno is transitioning to a context layer for product teams. Currently, issues are only created internally (via PM agent workflow or manually). The goal is to pull existing issues/tickets from Jira and Linear into Hissuno's issues table so they can be enriched with feedback matching (linked sessions/contacts/companies), embedded for agentic search, and optionally analyzed via the existing issue-analysis workflow.

The schema already has `jiraIssueSyncs` and `linearIssueSyncs` tables for dedup tracking, but no sync logic exists. OAuth clients exist with token refresh, but lack issue-fetching functions.

---

## Phase 1: Schema Changes

### 1a. Add `source` and `external_url` to `issues` table

**File:** `app/src/lib/db/schema/app.ts` (line ~342, after `status`)

```
source: text('source'),          // 'hissuno' | 'jira' | 'linear' | null (null = hissuno)
external_url: text('external_url'),
```

Follows the same pattern as `sessions.source` (line 253).

### 1b. Update types

**File:** `app/src/types/issue.ts`
- Add `IssueSource = 'hissuno' | 'jira' | 'linear'` type
- Add `source: IssueSource | null` and `external_url: string | null` to `IssueRecord`
- Add `source?: IssueSource` to `IssueFilters`

### 1c. Update queries

**File:** `app/src/lib/db/queries/issues.ts`
- Add `source` and `external_url` to `rowToIssueRecord()` (line 55)
- Add `source?` and `externalUrl?` to `InsertIssueData` (line 93)
- Pass them through in `insertIssue()` (line 118)
- Add `source` filter support to `listIssues()` (line 366)

### 1d. Migration

Run `npx drizzle-kit generate` to create migration adding two nullable text columns. No backfill needed.

---

## Phase 2: API Client Extensions

### 2a. Jira - add issue fetching

**File:** `app/src/lib/integrations/jira/client.ts`

Add `getJiraIssues()` using existing `jiraFetch()`:
- Build JQL: `project = ${projectKey}`, with optional `AND updated >= '${date}'` for incremental
- Call `/rest/api/3/search` with pagination (`startAt`, `maxResults`)
- Extract: `id`, `key`, `fields.summary`, `fields.description` (ADF), `fields.issuetype.name`, `fields.status.name`, `fields.priority.name`, `fields.labels`, `fields.components`, `fields.created`, `fields.updated`
- Return typed `JiraIssuePayload[]`

Add `convertAdfToPlaintext()` - simple recursive ADF text extractor (Jira v3 returns ADF for descriptions).

**File:** `app/src/types/jira.ts` - add `JiraIssuePayload` interface

### 2b. Linear - add issue fetching

**File:** `app/src/lib/integrations/linear/client.ts`

Add `getLinearIssues()` using existing `createAuthedLinearClient()`:
- Use `client.issues()` with `filter: { team: { id: { eq: teamId } }, updatedAt: { gte: date } }`
- Cursor-based pagination via `after`/`first`
- Extract: `id`, `identifier`, `title`, `description` (markdown), `state.name`, `state.type`, `priority`, `priorityLabel`, `url`, `labels`, `createdAt`, `updatedAt`

**File:** `app/src/types/linear.ts` - add `LinearIssuePayload` interface

---

## Phase 3: Type/Status/Priority Mapping

**New file:** `app/src/lib/integrations/shared/issue-mapping.ts`

Three pure mapping functions:

- `mapExternalIssueType(externalType: string)` -> `bug | feature_request | change_request`
  - "bug"/"defect" -> `bug`, "feature"/"story"/"epic"/"enhancement" -> `feature_request`, else -> `change_request`

- `mapExternalStatus(source, statusName, stateType?)` -> Hissuno status
  - Linear: use `stateType` (backlog/unstarted->open, started->in_progress, completed->resolved, canceled->closed)
  - Jira: heuristic on status name

- `mapExternalPriority(source, priority)` -> `low | medium | high`
  - Linear: numeric (1-2->high, 3->medium, 4->low)
  - Jira: string-based (highest/blocker/critical->high, etc.)

---

## Phase 4: Sync Logic

### 4a. Sync table helpers

**Files:** `app/src/lib/integrations/jira/index.ts` and `linear/index.ts`

Add to each (following Zendesk's `isTicketSynced`/`recordSyncedTicket` pattern):
- `isExternalIssueSynced(connectionId, externalId)` - check dedup
- `getIssueSyncByExternalId(connectionId, externalId)` - get existing sync row
- `recordIssueSync(params)` - insert sync row
- `updateIssueSyncStatus(syncId, params)` - update sync row

### 4b. Jira sync implementation

**New file:** `app/src/lib/integrations/jira/sync.ts`

Core function: `syncJiraIssues(projectId, options)` following Zendesk sync pattern.

Per-issue flow:
1. Check dedup via `jiraIssueSyncs`
2. **New issue:** map type/status/priority, call `insertIssue()` with `source: 'jira'` and `externalUrl`, create embedding via `upsertIssueEmbedding()`, insert sync row, run feedback matching
3. **Existing (update):** compare status/title/description, update if changed, re-embed if text changed, update sync row

Incremental mode: use `last_synced_at` from most recent sync row as JQL `updatedSince` filter.

### 4c. Linear sync implementation

**New file:** `app/src/lib/integrations/linear/sync.ts`

Same structure as Jira sync, using Linear client and `linearIssueSyncs`.

### 4d. Feedback matching (post-import)

**New file:** `app/src/lib/integrations/shared/feedback-matching.ts`

```ts
async function matchFeedbackToIssue(issueId, projectId, title, description, options?)
```

Uses existing `searchSessionsSemantic()` from `app/src/lib/sessions/embedding-service.ts` with the issue's title+description as query. For each match above threshold (default 0.6), calls `linkEntities()` to create issue<->session relationship in `entity_relationships`. Through existing session->contact->company links, the issue automatically inherits customer context.

---

## Phase 5: API Routes

### 5a. Manual sync (SSE streaming)

**New files:**
- `app/src/app/api/(project)/integrations/jira/sync/route.ts`
- `app/src/app/api/(project)/integrations/linear/sync/route.ts`

Follow exact pattern from `app/src/app/api/(project)/integrations/zendesk/sync/route.ts`:
- Auth via `requireRequestIdentity()` + `assertProjectAccess()`
- Check connection status
- Parse `mode` param (incremental/full)
- `createSSEStreamWithExecutor()` with progress streaming
- Call sync function with `onProgress` callback

### 5b. Frontend API helpers

**File:** `app/src/lib/api/integrations.ts`

Add `jiraSyncUrl(projectId, mode)` and `linearSyncUrl(projectId, mode)` - matching `zendeskSyncUrl` pattern.

---

## Phase 6: Embedding for Agentic Search

When importing an issue, the embedding text should include external metadata for richer search:

```
${title}

${description}

Source: Jira (PROJ-123)
Labels: performance, backend
Components: API Gateway
```

This is handled in the sync logic when calling `upsertIssueEmbedding()` - pass an enriched description string.

---

## Implementation Order

1. Schema: add `source` + `external_url` to issues, update types, generate migration
2. Mapping utils: `shared/issue-mapping.ts`
3. Jira client: `getJiraIssues()`, `convertAdfToPlaintext()`, types
4. Linear client: `getLinearIssues()`, types
5. Sync table helpers in both `jira/index.ts` and `linear/index.ts`
6. Feedback matching helper: `shared/feedback-matching.ts`
7. Jira sync: `jira/sync.ts`
8. Linear sync: `linear/sync.ts`
9. SSE routes for both
10. Frontend API helpers

---

## Key Files

| Purpose | File |
|---------|------|
| Issues schema | `app/src/lib/db/schema/app.ts` (lines 333-365, 640-709) |
| Issues queries | `app/src/lib/db/queries/issues.ts` |
| Issue types | `app/src/types/issue.ts` |
| Issue embeddings | `app/src/lib/issues/embedding-service.ts` |
| Issue service | `app/src/lib/issues/issues-service.ts` |
| Session semantic search | `app/src/lib/sessions/embedding-service.ts` |
| Entity relationships | `app/src/lib/db/queries/entity-relationships.ts` |
| Jira client | `app/src/lib/integrations/jira/client.ts` |
| Linear client | `app/src/lib/integrations/linear/client.ts` |
| Jira connection mgmt | `app/src/lib/integrations/jira/index.ts` |
| Linear connection mgmt | `app/src/lib/integrations/linear/index.ts` |
| Zendesk sync (reference) | `app/src/lib/integrations/zendesk/sync.ts` |
| Zendesk SSE route (reference) | `app/src/app/api/(project)/integrations/zendesk/sync/route.ts` |
| SSE utilities | `app/src/lib/sse/index.ts` |
| Schema relations | `app/src/lib/db/schema/relations.ts` |

## Verification

1. Run `npx drizzle-kit generate` - verify migration adds `source` and `external_url` columns
2. Run `npx drizzle-kit push` to apply migration locally
3. Verify existing issue creation still works (source defaults to null)
4. Test Jira sync with a real Jira project - verify issues appear in DB with correct type/status/priority mapping
5. Test Linear sync with a real Linear team - same verification
6. Verify embeddings created for imported issues (check `issue_embeddings` table)
7. Verify feedback matching links sessions to imported issues (check `entity_relationships`)
8. Test incremental sync - only new/updated issues should be processed
9. Test dedup - re-syncing should update existing issues, not create duplicates
