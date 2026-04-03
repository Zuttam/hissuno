# GitHub Multi-Resource Integration: Issues as Feedback

## Context

GitHub issues are user-created, unvalidated feedback - just like Zendesk tickets or Intercom conversations. They should be imported as **sessions** (not Hissuno issues), so they flow through the same analysis pipeline that extracts validated issues, links contacts, and tags product scopes.

The current GitHub integration only supports codebase (knowledge source) import. This plan extends it to also sync GitHub Issues as feedback sessions, following the Notion integration's multi-resource mapping pattern (`notionSyncConfigs` with `sync_type` column).

**Codebase stays as-is.** The codebase import is a manual one-time operation (select repo/branch -> download -> create knowledge source). It doesn't fit the recurring sync model. The `githubSyncConfigs` table uses a `sync_type` discriminator that can accommodate `'codebase'` later if that flow evolves, but we only implement `'feedback'` now. The UI unifies both under tabs.

---

## 1. Schema Changes

**File:** `app/src/lib/db/schema/app.ts` (after `githubAppInstallations`, ~line 576)

### `githubSyncConfigs` table
Mirrors `notionSyncConfigs` exactly:
```
id, installation_id (FK -> github_app_installations.id, cascade delete),
project_id (FK -> projects.id), sync_type (text, 'feedback'),
github_repo_ids (jsonb - array of {id, fullName}),
github_label_filter (text, nullable - only sync issues with this label),
github_label_tag_map (jsonb, nullable - {githubLabel: sessionTag}),
sync_enabled, sync_frequency, last_sync_at, last_sync_status,
last_sync_error, next_sync_at, last_sync_count, created_at, updated_at
```
Unique constraint on `(installation_id, sync_type)`.

### `githubSyncedIssues` dedup table
Mirrors `zendeskSyncedTickets`:
```
id, installation_id (FK -> github_app_installations.id, cascade delete),
session_id (FK -> sessions.id), github_issue_id (integer),
github_issue_number (integer), github_repo_full_name (text),
github_issue_url (text), github_issue_updated_at (timestamp),
last_synced_at, created_at
```

### Relations
**File:** `app/src/lib/db/schema/relations.ts`
- Add `githubSyncConfigsRelations` and `githubSyncedIssuesRelations`
- Update `githubAppInstallationsRelations` with `many(githubSyncConfigs)`, `many(githubSyncedIssues)`

### Session source type
**File:** `app/src/types/session.ts`
- Add `'github'` to `SESSION_SOURCES` array
- Add `github: { label: 'GitHub', variant: 'default' }` to `SESSION_SOURCE_INFO`
- `getDefaultSessionType` already returns `'chat'` for unknown sources - no change needed

### Migration
`npx drizzle-kit generate` then `npx drizzle-kit push`

---

## 2. GitHub API Client Extensions

**File:** `app/src/lib/integrations/github/app-client.ts`

Add types `GitHubIssue` and `GitHubComment`, plus:
- `listRepoIssues(token, owner, repo, opts?)` - paginated fetch via `GET /repos/{o}/{r}/issues?state=all&per_page=100`. Filter out PRs (check `pull_request` field absence). Support `labels` and `since` query params.
- `getIssueComments(token, owner, repo, issueNumber)` - paginated fetch via `GET /repos/{o}/{r}/issues/{n}/comments`

---

## 3. Service Layer - Sync Config CRUD

**File:** `app/src/lib/integrations/github/index.ts`

Add (following Notion's `index.ts` pattern):
- `getGitHubSyncConfig(projectId, syncType)` - select from `githubSyncConfigs`
- `upsertGitHubSyncConfig(params)` - upsert on `(installation_id, sync_type)`
- `deleteGitHubSyncConfig(projectId, syncType)`
- `getGitHubInstallationUuid(projectId)` - returns the `github_app_installations.id` (UUID PK) for FK usage
- `getSyncedIssueIds(installationUuid)` - returns `Set<number>` of already-synced `github_issue_id`s
- `recordSyncedIssue(params)` - insert into `githubSyncedIssues`

Update `disconnectGitHub` to also handle sync config cleanup (cascade handles it, but log for clarity).

---

## 4. Sync Logic

**New file:** `app/src/lib/integrations/github/sync-feedback.ts`

Pattern: follows `lib/integrations/zendesk/sync.ts` and `lib/integrations/notion/sync-issues.ts`

### Flow
1. Load sync config + credentials + installation UUID
2. Mark sync as `in_progress`
3. Pre-fetch synced issue IDs for dedup
4. For each repo in `github_repo_ids`:
   - `listRepoIssues(token, owner, repo, { labels: labelFilter, since: lastSyncAt })`
   - Skip PRs, skip already-synced
   - For each new issue:
     - Fetch comments via `getIssueComments`
     - Map to session:
       - `source: 'github'`, `session_type: 'chat'`, `status: 'closed'`
       - `name`: `"#${number} ${title}"`
       - `user_metadata`: `{ github_issue_id, github_issue_number, github_repo, github_issue_url, github_username: issue.user.login, name: issue.user.login }`
       - `tags`: derive from `github_label_tag_map` config
     - Map to messages:
       - Issue body -> first message (`sender_type: 'user'`, `created_at: issue.created_at`)
       - Each comment -> message (`sender_type`: 'user' if `comment.user.login === issue.user.login`, else 'human_agent')
     - `createSessionWithMessagesAdmin()` from `lib/sessions/sessions-service.ts`
     - `recordSyncedIssue()`
5. Update sync config with results
6. Report progress via `onProgress` callback

### Incremental sync
Uses GitHub API `since` param (ISO timestamp) -> only fetches issues updated after `last_sync_at`. V1 is create-only (skip already-synced issues).

---

## 5. API Routes

### Sync config CRUD
**New file:** `app/src/app/api/(project)/integrations/github/sync-config/route.ts`
- GET `?projectId&syncType` - fetch config
- PUT body `{ projectId, syncType, githubRepoIds, ... }` - upsert
- DELETE `?projectId&syncType` - delete

### Manual sync trigger
**New file:** `app/src/app/api/(project)/integrations/github/sync/feedback/route.ts`
- GET `?projectId` - SSE stream using `createSSEStreamWithExecutor` from `@/lib/utils/sse`

### Cron
**New file:** `app/src/app/api/(system)/cron/github-sync/route.ts`
- GET - process due sync configs via `getConnectionsDueForSync()` from shared sync-utils
- Dispatches to `syncGitHubFeedback` for each

**Update:** `app/vercel.json` - add `{ "path": "/api/cron/github-sync", "schedule": "45 * * * *" }`

---

## 6. Frontend API Client

**File:** `app/src/lib/api/integrations.ts`

Add:
- `fetchGithubSyncConfig(projectId, syncType)`
- `saveGithubSyncConfig(body)`
- `deleteGithubSyncConfig(projectId, syncType)`
- `githubSyncFeedbackUrl(projectId)` - SSE URL builder

---

## 7. Frontend UI

### Restructure config dialog
**File:** `app/src/components/projects/integrations/github-config-dialog.tsx`

When connected, add Tabs (using existing tab components, matching Notion dialog pattern):
- **Codebase** tab - summary of existing knowledge source (read-only, links to Knowledge Sources page)
- **Feedback Sync** tab - new sync config UI

### New: Codebase tab
**New file:** `app/src/components/projects/integrations/github-codebase-sync-tab.tsx`
- Checks for existing `type='codebase'` knowledge source for project
- Shows repo name + branch if exists, or "Not configured" message
- Links to Knowledge Sources page for management

### New: Feedback sync tab
**New file:** `app/src/components/projects/integrations/github-feedback-sync-tab.tsx`

Following `notion-issue-sync-tab.tsx` pattern:
1. **Repo selection** - multi-select from `fetchGithubRepos()` (existing API)
2. **Label filter** - optional text input
3. **Label-to-tag mapping** - map GitHub labels to session tags (bug, feature_request, etc.)
4. **Sync frequency** - `FREQUENCY_OPTIONS` dropdown
5. **Sync status** - last sync time, count, status
6. **Sync Now** button - EventSource for SSE progress

---

## Implementation Order

1. Schema (tables + relations + migration)
2. Session source type (`'github'`)
3. GitHub API client (`listRepoIssues`, `getIssueComments`)
4. Service layer (sync config CRUD + dedup helpers)
5. Sync logic (`sync-feedback.ts`)
6. API routes (sync-config, sync trigger, cron)
7. Frontend API client helpers
8. Frontend UI (dialog tabs, codebase tab, feedback sync tab)

---

## Verification

1. **Schema**: Run `npx drizzle-kit push`, verify tables exist via `npx drizzle-kit studio`
2. **Unit flow**: Connect a GitHub account (existing flow), configure feedback sync with a test repo, trigger manual sync, verify sessions appear in the sessions list with `source: 'github'`
3. **Dedup**: Run sync twice, verify no duplicate sessions
4. **Incremental**: Add a new issue to the repo, sync again, verify only the new issue is imported
5. **Session content**: Open an imported session, verify issue body is first message, comments are subsequent messages with correct sender types
6. **Tags**: Configure label-to-tag mapping, verify imported sessions have correct tags
7. **Cron**: Verify `getConnectionsDueForSync` picks up enabled configs with past `next_sync_at`

## Key Files to Reference During Implementation

| Pattern | File |
|---------|------|
| Multi-resource sync config | `lib/integrations/notion/index.ts` |
| Issue sync logic | `lib/integrations/notion/sync-issues.ts` |
| Feedback sync (session creation) | `lib/integrations/zendesk/sync.ts` |
| SSE sync trigger route | `app/api/(project)/integrations/notion/sync/issues/route.ts` |
| Cron dispatch | `app/api/(system)/cron/notion-sync/route.ts` |
| Tabbed config dialog | `components/projects/integrations/notion-config-dialog.tsx` |
| Feedback sync tab | `components/projects/integrations/notion-issue-sync-tab.tsx` |
| Shared sync utils | `lib/integrations/shared/sync-utils.ts`, `sync-constants.ts` |
| Session service | `lib/sessions/sessions-service.ts` |
