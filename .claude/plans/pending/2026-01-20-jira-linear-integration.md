---
status: pending
created: 2026-01-20
updated: 2026-01-23
impact: high
summary: Jira integration for automatic issue ticket creation and spec sync
---

# Plan: Jira & Linear Integration

## Overview

Enable users to automatically sync Hissuno issues to Jira (and later Linear). When an issue is created in Hissuno, a corresponding ticket is created in Jira. When a spec is generated, the Jira ticket is updated with a link to the spec.

## Requirements Summary

| Requirement | Decision |
|-------------|----------|
| Authentication | OAuth App |
| Sync direction | One-way push (Hissuno → Jira) |
| Sync triggers | Issue creation, spec generation |
| Ticket content | Title, description, link to Hissuno |
| Config level | Project-level |
| Trigger mode | Automatic |
| Platform priority | Jira first, then Linear |
| Failure handling | Retry with notification |
| Architecture | Direct sync with retry tracking (simplified) |

---

## Phase 1: Database Schema

### New Tables

```sql
-- Store Jira OAuth connections per project
-- Follows existing pattern: slack_workspace_tokens, github_app_installations
CREATE TABLE jira_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- OAuth credentials
  cloud_id TEXT NOT NULL,               -- Jira site identifier
  site_url TEXT NOT NULL,               -- e.g., https://yoursite.atlassian.net
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,

  -- Configuration (NULL until user selects project)
  jira_project_key TEXT,                -- Target project key (e.g., "HISS")
  jira_project_id TEXT,                 -- Jira's internal project ID
  issue_type_id TEXT,                   -- Default issue type ID
  issue_type_name TEXT,                 -- For display (e.g., "Task")
  is_enabled BOOLEAN DEFAULT true,

  -- Metadata (follows slack pattern)
  installed_by_user_id UUID REFERENCES auth.users(id),
  installed_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id)  -- One integration per project
);

-- Track issue sync state (simplified from job queue)
CREATE TABLE jira_issue_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES jira_connections(id) ON DELETE CASCADE,

  -- Jira ticket reference
  jira_issue_key TEXT,                  -- e.g., "HISS-123"
  jira_issue_id TEXT,                   -- Jira's internal issue ID
  jira_issue_url TEXT,                  -- Full URL to Jira issue

  -- Sync tracking
  last_sync_action TEXT,                -- 'create' or 'update_spec'
  last_sync_status TEXT DEFAULT 'pending', -- pending, success, failed
  last_sync_error TEXT,
  retry_count INT DEFAULT 0,
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(issue_id)  -- One sync record per issue
);

-- RLS policies (follows existing pattern)
ALTER TABLE jira_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE jira_issue_syncs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project jira connections"
  ON jira_connections FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own project jira connections"
  ON jira_connections FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own project jira connections"
  ON jira_connections FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own project jira connections"
  ON jira_connections FOR DELETE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own issue jira syncs"
  ON jira_issue_syncs FOR SELECT
  USING (issue_id IN (
    SELECT i.id FROM issues i
    JOIN projects p ON i.project_id = p.id
    WHERE p.user_id = auth.uid()
  ));
```

### Files to Create/Modify
- `app/supabase/migrations/YYYYMMDD_add_jira_connections.sql`
- `app/src/types/supabase.ts` (regenerate)
- `app/src/types/jira.ts` (new types file)

---

## Phase 2: OAuth Flow

### Jira OAuth 2.0 (3LO) Flow

1. **User clicks "Connect Jira"** → Redirect to Atlassian authorization URL
2. **User authorizes** → Atlassian redirects to callback with `code`
3. **Exchange code for tokens** → Store `access_token`, `refresh_token`
4. **Fetch accessible resources** → Get `cloud_id` and available projects
5. **User selects target project** → Save `jira_project_key` and `issue_type_id`

### API Routes (follows existing GitHub/Slack pattern)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/jira` | GET | Get integration status (via ?projectId query) |
| `/api/integrations/jira` | DELETE | Disconnect integration |
| `/api/integrations/jira/connect` | GET | Generate OAuth URL, redirect user |
| `/api/integrations/jira/callback` | GET | Handle OAuth callback, exchange code |
| `/api/integrations/jira/projects` | GET | List Jira projects user can access |
| `/api/integrations/jira/issue-types` | GET | List issue types for selected project |
| `/api/integrations/jira/configure` | POST | Save project/issue type selection |

### Service Layer

```typescript
// app/src/lib/integrations/jira/oauth.ts
export async function generateAuthUrl(projectId: string, userId: string): Promise<string>
export async function exchangeCodeForTokens(code: string): Promise<JiraTokens>
export async function refreshAccessToken(connection: JiraConnection): Promise<JiraTokens>

// app/src/lib/integrations/jira/client.ts
export async function getAccessibleResources(accessToken: string): Promise<JiraResource[]>
export async function getProjects(cloudId: string, accessToken: string): Promise<JiraProject[]>
export async function getIssueTypes(cloudId: string, projectKey: string, accessToken: string): Promise<JiraIssueType[]>
export async function createIssue(cloudId: string, payload: CreateIssuePayload, accessToken: string): Promise<JiraIssue>
export async function addComment(cloudId: string, issueKey: string, comment: string, accessToken: string): Promise<void>
```

### Environment Variables

```
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
JIRA_REDIRECT_URI=https://app.hissuno.com/api/integrations/jira/callback
```

---

## Phase 3: Sync Flow

### Issue Creation → Jira Ticket

```
1. Issue created in Hissuno (via PM agent or manually)
   ↓
2. Check if project has active Jira connection (is_enabled && jira_project_key)
   ↓
3. Call triggerJiraSyncForIssue(issueId, 'create')
   ↓
4. Create/update jira_issue_syncs record (status='pending')
   ↓
5. Attempt sync immediately:
   - Create Jira ticket via API
   - Summary: issue.title
   - Description: issue.description + "\n\n---\nView in Hissuno: {link}"
   - Issue Type: from connection config
   ↓
6. On success: Update sync record with jira_issue_key, status='success'
   On failure: Update sync record with error, retry_count++
```

### Spec Generated → Update Jira Ticket

```
1. Spec generation completes (product_spec saved to issue)
   ↓
2. Check if issue has jira_issue_key in jira_issue_syncs
   ↓
3. Call triggerJiraSyncForIssue(issueId, 'update_spec')
   ↓
4. Attempt sync immediately:
   - Add comment to Jira ticket:
     "📋 Product spec generated. View full spec: {link}"
   ↓
5. Update sync record with last_sync_action='update_spec', status
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/cron/jira-sync` | POST | Cron endpoint - retry failed syncs |
| `/api/issues/[id]/jira-status` | GET | Get sync status for an issue |
| `/api/issues/[id]/jira-sync` | POST | Manual retry sync |

### Service Layer

```typescript
// app/src/lib/integrations/jira/sync.ts
export async function triggerJiraSyncForIssue(issueId: string, action: 'create' | 'update_spec'): Promise<void>
export async function createJiraTicket(issue: Issue, connection: JiraConnection): Promise<JiraTicketResult>
export async function addSpecComment(jiraIssueKey: string, specUrl: string, connection: JiraConnection): Promise<void>
export async function retryFailedSyncs(): Promise<SyncResult>
```

### Trigger Points (modify existing code)

1. **Issue creation** - `app/src/lib/supabase/issues.ts` → `createManualIssue()`
2. **PM agent issue creation** - `app/src/mastra/tools/issue-tools.ts` → after issue insert
3. **Spec generation complete** - `app/src/lib/issues/spec-generation-service.ts` → after spec saved

---

## Phase 4: UI Components

### Integration Setup (follows existing dialog pattern)

Location: `app/src/components/projects/edit-dialogs/jira-config-dialog.tsx`

Current state in integrations page: Jira shows as "Coming Soon"

Dialog states:
1. **Disconnected state**: "Connect Jira" button
2. **OAuth in progress**: Loading spinner
3. **Connected, needs config**: Project/issue type selector dropdowns
4. **Fully configured**: Show connected project, "Disconnect" button

### Issue Detail View

Location: `app/src/components/issues/` (find issue detail component)

Add:
- Jira ticket link badge (if synced)
- Sync status indicator (pending/synced/failed)
- Manual "Retry sync" button if failed

### New Components

```
app/src/components/projects/edit-dialogs/
├── jira-config-dialog.tsx          # Main dialog (new)
├── jira/                           # Optional subfolder for complex parts
│   ├── jira-project-selector.tsx   # Project + issue type selector
│   └── jira-status-badge.tsx       # Connection status badge
└── index.ts                        # Add exports
```

### Hooks

```typescript
// Update existing hook
// app/src/hooks/use-integrations.ts
// Add Jira to the existing integration handling

// New hook for issue sync status
// app/src/hooks/use-jira-sync.ts
export function useJiraSyncStatus(issueId: string)
```

---

## Phase 5: Cron Job

### GitHub Actions Cron (follows existing pattern)

```yaml
# .github/workflows/cron-jira-sync.yml
name: Jira Sync Cron

on:
  schedule:
    - cron: '*/10 * * * *' # Every 10 minutes
  workflow_dispatch: {} # Allow manual triggers

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Jira sync retry
        run: |
          curl -sf -X GET "${{ secrets.CRON_URL }}/api/cron/jira-sync" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Processing Logic

```typescript
// /api/cron/jira-sync/route.ts
export async function GET(request: Request) {
  // Verify CRON_SECRET from Authorization header
  // Fetch failed syncs where retry_count < 3
  // For each:
  //   - Refresh token if needed
  //   - Retry sync action
  //   - Update status
  // Return summary
}
```

### Retry Logic

- Max 3 retries
- Failed syncs with `retry_count >= 3` marked permanently failed
- Failed syncs surface in issue UI for manual retry

---

## Error Handling

| Error Type | Handling |
|------------|----------|
| OAuth token expired | Auto-refresh using refresh_token before API call |
| Jira API rate limit | Exponential backoff, mark for cron retry |
| Invalid Jira project | Mark sync failed, surface in UI |
| Network error | Retry up to 3 times |
| User revoked access | Mark connection as disconnected, clear tokens |

---

## Files Summary

### New Files
- `app/supabase/migrations/YYYYMMDD_add_jira_connections.sql`
- `app/src/types/jira.ts`
- `app/src/lib/integrations/jira/index.ts`
- `app/src/lib/integrations/jira/oauth.ts`
- `app/src/lib/integrations/jira/client.ts`
- `app/src/lib/integrations/jira/sync.ts`
- `app/src/app/api/integrations/jira/route.ts`
- `app/src/app/api/integrations/jira/connect/route.ts`
- `app/src/app/api/integrations/jira/callback/route.ts`
- `app/src/app/api/integrations/jira/projects/route.ts`
- `app/src/app/api/integrations/jira/issue-types/route.ts`
- `app/src/app/api/integrations/jira/configure/route.ts`
- `app/src/app/api/cron/jira-sync/route.ts`
- `app/src/app/api/issues/[id]/jira-status/route.ts`
- `app/src/app/api/issues/[id]/jira-sync/route.ts`
- `app/src/components/projects/edit-dialogs/jira-config-dialog.tsx`
- `app/src/hooks/use-jira-sync.ts`

### New Workflow File
- `.github/workflows/cron-jira-sync.yml` (GitHub Actions cron)

### Modified Files
- `app/src/hooks/use-integrations.ts` (add Jira OAuth flow)
- `app/src/lib/supabase/issues.ts` (add sync trigger)
- `app/src/mastra/tools/issue-tools.ts` (add sync trigger)
- `app/src/lib/issues/spec-generation-service.ts` (add sync trigger)
- `app/src/components/projects/edit-dialogs/index.ts` (export JiraConfigDialog)
- `app/src/app/(authenticated)/projects/[id]/integrations/page.tsx` (enable Jira, add dialog)
- Issue detail component (add Jira badge)

---

## Verification

1. **OAuth flow**: Connect Jira, verify tokens stored, verify project selection works
2. **Issue creation sync**: Create issue manually, verify Jira ticket created
3. **PM agent sync**: Let PM agent create issue, verify Jira ticket created
4. **Spec update sync**: Generate spec, verify comment added to Jira ticket
5. **Error handling**: Disconnect Jira mid-sync, verify retry and failure states
6. **UI states**: Verify all connection states display correctly
7. **Cron retry**: Manually fail a sync, verify cron retries it

---

## Future: Linear Integration

Once Jira is complete, Linear follows the same pattern:
- `linear_connections` table (same structure, different OAuth fields)
- Linear OAuth flow (simpler than Jira)
- Linear GraphQL API for ticket creation
- Shared sync trigger infrastructure with Jira

Consider abstracting common patterns into a shared integration layer when adding Linear:
- Generic `triggerIssueSyncForIssue()` that checks all enabled integrations
- Shared sync status UI components
