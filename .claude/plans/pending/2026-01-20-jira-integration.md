---
status: pending
created: 2026-01-20
updated: 2026-01-24
impact: high
summary: Jira integration for automatic issue ticket creation, spec sync, and status updates via webhooks
---

# Plan: Jira Integration

## Overview

Enable users to automatically sync Hissuno issues to Jira (and later Linear). When an issue is created in Hissuno, a corresponding ticket is created in Jira. When a spec is generated, the Jira ticket is updated with a link to the spec. **When a Jira ticket status changes (resolved/rejected), Hissuno receives a webhook to update the linked issue status.**

## Requirements Summary

| Requirement | Decision |
|-------------|----------|
| Authentication | OAuth App |
| Sync direction | **Bidirectional** (Hissuno → Jira push, Jira → Hissuno webhook) |
| Sync triggers | Issue creation, spec generation, **Jira status change** |
| Ticket content | Title, description, link to Hissuno |
| Config level | Project-level |
| Trigger mode | Automatic |
| Failure handling | Retry with notification |
| Architecture | Direct sync with retry tracking + webhook receiver |

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

  -- Webhook configuration
  webhook_id TEXT,                      -- Jira webhook ID (for cleanup on disconnect)
  webhook_secret TEXT,                  -- Secret for webhook signature verification

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

  -- Sync tracking (outbound: Hissuno → Jira)
  last_sync_action TEXT,                -- 'create' or 'update_spec'
  last_sync_status TEXT DEFAULT 'pending', -- pending, success, failed
  last_sync_error TEXT,
  retry_count INT DEFAULT 0,
  last_synced_at TIMESTAMPTZ,

  -- Webhook tracking (inbound: Jira → Hissuno)
  last_jira_status TEXT,                -- Last known Jira status (e.g., "Done", "In Progress")
  last_webhook_received_at TIMESTAMPTZ, -- When we last received a webhook for this issue

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(issue_id)  -- One sync record per issue
);

-- Index for webhook lookups by Jira issue key
CREATE INDEX jira_issue_syncs_jira_issue_key_idx ON jira_issue_syncs(jira_issue_key);
CREATE INDEX jira_issue_syncs_jira_issue_id_idx ON jira_issue_syncs(jira_issue_id);

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
5. **Register webhook** → Auto-register webhook with `labels = hissuno` JQL filter
6. **User selects target project** → Save `jira_project_key` and `issue_type_id`

### API Routes (follows existing GitHub/Slack pattern)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/jira` | GET | Get integration status (via ?projectId query) |
| `/api/integrations/jira` | DELETE | Disconnect integration |
| `/api/integrations/jira/connect` | GET | Generate OAuth URL, redirect user |
| `/api/integrations/jira/callback` | GET | Handle OAuth callback, exchange code, register webhook |
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
// Note: createIssue payload should include labels: ["hissuno"] for identification
export async function addComment(cloudId: string, issueKey: string, comment: string, accessToken: string): Promise<void>
```

### Environment Variables

```
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
JIRA_REDIRECT_URI=https://hissuno.com/api/integrations/jira/callback
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
   - Labels: ["hissuno"]  ← IMPORTANT: Tag for identification & webhook filtering
   ↓
6. On success: Update sync record with jira_issue_key, status='success'
   On failure: Update sync record with error, retry_count++
```

### Jira Ticket Labeling

All Jira tickets created by Hissuno are labeled with `hissuno` for:
- **Identification**: Easy to see which tickets came from Hissuno
- **Webhook filtering**: Only process webhooks for labeled issues (extra safety)
- **JQL queries**: `labels = hissuno` to find all synced issues

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

## Phase 6: Webhook for Status Updates (Jira → Hissuno)

When a Jira ticket status changes (e.g., moved to "Done" or "Won't Do"), Hissuno receives a webhook and updates the linked issue status.

### Jira Webhook Registration

Webhook is registered automatically during OAuth callback (not user-configurable):

```typescript
// Called during /api/integrations/jira/callback after token exchange
export async function registerJiraWebhook(cloudId: string, accessToken: string): Promise<{ webhookId: string; webhookSecret: string }> {
  // Jira REST API: POST /rest/api/3/webhook
  const webhookSecret = crypto.randomBytes(32).toString('hex')

  const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/webhook`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/jira`,
      webhooks: [{
        events: ['jira:issue_updated'],
        // Filter by hissuno label only - no project filter needed
        // This catches all Hissuno-created issues across any project in this Jira site
        jqlFilter: `labels = hissuno`,
      }],
    }),
  })

  const data = await response.json()
  return { webhookId: data.webhookRegistrationResult[0].createdWebhookId, webhookSecret }
}
```

**Why register in callback (not configure)?**
- Webhook uses `labels = hissuno` filter - no project key needed
- User doesn't need to configure webhook settings
- Webhook is ready immediately after OAuth completes
- Works even if user hasn't selected a Jira project yet

### Webhook Endpoint

**Route:** `app/src/app/api/webhooks/jira/route.ts`

**Follows Slack webhook pattern** (see `app/src/app/api/webhooks/slack/route.ts`):

```typescript
import { createAdminClient } from '@/lib/supabase/server'
import { handleJiraWebhookEvent } from '@/lib/integrations/jira/webhook'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.text()
  const payload = JSON.parse(body)

  const issueKey = payload.issue?.key
  const labels = payload.issue?.fields?.labels || []

  // Only process issues with "hissuno" label (our issues)
  if (!labels.includes('hissuno')) {
    return new Response('OK', { status: 200 }) // Ignore non-Hissuno issues
  }

  if (!issueKey) {
    return new Response('Missing issue key', { status: 400 })
  }

  // Find connection by issue key to verify this is our issue
  const supabase = createAdminClient()
  const { data: sync } = await supabase
    .from('jira_issue_syncs')
    .select('connection_id, jira_connections(webhook_secret)')
    .eq('jira_issue_key', issueKey)
    .single()

  if (!sync) {
    // Has hissuno label but not in our DB - log warning
    console.warn(`[webhook.jira] Issue ${issueKey} has hissuno label but not found in DB`)
    return new Response('OK', { status: 200 })
  }

  // Process asynchronously (immediate response pattern from Slack)
  setImmediate(() => {
    void handleJiraWebhookEvent(payload, sync.connection_id)
  })

  return new Response('OK', { status: 200 })
}
```

### Status Mapping

Map Jira status categories to Hissuno issue statuses:

```typescript
// app/src/lib/integrations/jira/webhook.ts

// Jira uses status categories: 'new', 'indeterminate', 'done'
const JIRA_TO_HISSUNO_STATUS: Record<string, IssueStatus | null> = {
  // Status Category: done
  'Done': 'resolved',
  'Resolved': 'resolved',
  'Closed': 'resolved',

  // Rejection statuses (still category: done)
  "Won't Do": 'closed',
  'Rejected': 'closed',
  'Declined': 'closed',
  'Cancelled': 'closed',

  // Status Category: indeterminate (in progress)
  'In Progress': 'in_progress',
  'In Review': 'in_progress',
  'In Development': 'in_progress',

  // Status Category: new (not started)
  'To Do': null,           // Don't update - Hissuno may have more specific status
  'Open': null,
  'Backlog': null,
}

export async function handleJiraWebhookEvent(
  payload: JiraWebhookPayload,
  connectionId: string
): Promise<void> {
  const supabase = createAdminClient()

  // Only process issue_updated events with status changes
  if (payload.webhookEvent !== 'jira:issue_updated') return

  const statusChange = payload.changelog?.items?.find(
    item => item.field === 'status'
  )
  if (!statusChange) return

  const newJiraStatus = statusChange.toString // e.g., "Done", "In Progress"
  const jiraIssueKey = payload.issue.key

  // Find linked Hissuno issue
  const { data: sync } = await supabase
    .from('jira_issue_syncs')
    .select('issue_id')
    .eq('jira_issue_key', jiraIssueKey)
    .single()

  if (!sync) return

  // Map to Hissuno status
  const hissunoStatus = JIRA_TO_HISSUNO_STATUS[newJiraStatus]
  if (!hissunoStatus) return // Status not mapped or should be ignored

  // Update Hissuno issue status
  await supabase
    .from('issues')
    .update({ status: hissunoStatus, updated_at: new Date().toISOString() })
    .eq('id', sync.issue_id)

  // Update sync record
  await supabase
    .from('jira_issue_syncs')
    .update({
      last_jira_status: newJiraStatus,
      last_webhook_received_at: new Date().toISOString(),
    })
    .eq('jira_issue_key', jiraIssueKey)

  console.log(`[webhook.jira] Updated issue ${sync.issue_id} to status ${hissunoStatus} (Jira: ${newJiraStatus})`)
}
```

### Webhook Cleanup on Disconnect

When user disconnects Jira integration, delete the webhook:

```typescript
// Called during DELETE /api/integrations/jira
export async function deleteJiraWebhook(connection: JiraConnection): Promise<void> {
  if (!connection.webhook_id) return

  await fetch(`https://api.atlassian.com/ex/jira/${connection.cloud_id}/rest/api/3/webhook`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      webhookIds: [connection.webhook_id],
    }),
  })
}
```

### Service Layer Additions

```typescript
// app/src/lib/integrations/jira/webhook.ts (new file)
export function verifyJiraWebhookSignature(body: string, signature: string, secret: string): boolean
export async function handleJiraWebhookEvent(payload: JiraWebhookPayload, connectionId: string): Promise<void>
export async function registerJiraWebhook(connection: JiraConnection): Promise<string>
export async function deleteJiraWebhook(connection: JiraConnection): Promise<void>
```

### UI Updates for Inbound Sync

In issue detail view, show when status was last synced from Jira:
- "Status synced from Jira 2 hours ago" badge
- Visual indicator that status came from external source

---

## Error Handling

| Error Type | Handling |
|------------|----------|
| OAuth token expired | Auto-refresh using refresh_token before API call |
| Jira API rate limit | Exponential backoff, mark for cron retry |
| Invalid Jira project | Mark sync failed, surface in UI |
| Network error | Retry up to 3 times |
| User revoked access | Mark connection as disconnected, clear tokens |
| Webhook signature invalid | Log warning, return 200 (don't expose to attacker) |
| Unknown Jira issue key | Ignore silently (not our issue) |
| Unmapped Jira status | Log, don't update Hissuno (manual review) |

---

## Files Summary

### New Files
- `app/supabase/migrations/YYYYMMDD_add_jira_connections.sql`
- `app/src/types/jira.ts`
- `app/src/lib/integrations/jira/index.ts`
- `app/src/lib/integrations/jira/oauth.ts`
- `app/src/lib/integrations/jira/client.ts`
- `app/src/lib/integrations/jira/sync.ts`
- `app/src/lib/integrations/jira/webhook.ts` **(NEW - webhook handling)**
- `app/src/app/api/integrations/jira/route.ts`
- `app/src/app/api/integrations/jira/connect/route.ts`
- `app/src/app/api/integrations/jira/callback/route.ts`
- `app/src/app/api/integrations/jira/projects/route.ts`
- `app/src/app/api/integrations/jira/issue-types/route.ts`
- `app/src/app/api/integrations/jira/configure/route.ts`
- `app/src/app/api/webhooks/jira/route.ts` **(NEW - webhook endpoint)**
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
2. **Webhook registration**: Verify webhook is created in Jira when configuring project
3. **Issue creation sync**: Create issue manually, verify Jira ticket created
4. **PM agent sync**: Let PM agent create issue, verify Jira ticket created
5. **Spec update sync**: Generate spec, verify comment added to Jira ticket
6. **Inbound status sync (resolved)**: Move Jira ticket to "Done", verify Hissuno issue becomes `resolved`
7. **Inbound status sync (rejected)**: Move Jira ticket to "Won't Do", verify Hissuno issue becomes `closed`
8. **Inbound status sync (in progress)**: Move Jira ticket to "In Progress", verify Hissuno issue becomes `in_progress`
9. **Error handling**: Disconnect Jira mid-sync, verify retry and failure states
10. **Webhook cleanup**: Disconnect Jira integration, verify webhook is deleted from Jira
11. **UI states**: Verify all connection states display correctly
12. **Cron retry**: Manually fail a sync, verify cron retries it
