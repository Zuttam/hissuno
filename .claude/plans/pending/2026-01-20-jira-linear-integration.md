---
status: pending
created: 2026-01-20
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
| Architecture | Database-driven queue |

---

## Phase 1: Database Schema

### New Tables

```sql
-- Store Jira OAuth connections per project
CREATE TABLE jira_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- OAuth credentials
  cloud_id TEXT NOT NULL,          -- Jira site identifier
  site_url TEXT NOT NULL,          -- e.g., https://yoursite.atlassian.net
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,

  -- Configuration
  jira_project_key TEXT NOT NULL,  -- Target project in Jira (e.g., "HISS")
  issue_type_id TEXT NOT NULL,     -- Default issue type (e.g., "Task")
  is_enabled BOOLEAN DEFAULT true,

  -- Metadata
  installed_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id)  -- One integration per project
);

-- Track sync jobs and map Hissuno issues to Jira tickets
CREATE TABLE jira_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES jira_integrations(id) ON DELETE CASCADE,

  -- Job state
  action TEXT NOT NULL,            -- 'create' or 'update_spec'
  status TEXT DEFAULT 'pending',   -- pending, processing, completed, failed
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,

  -- Result
  jira_issue_key TEXT,             -- e.g., "HISS-123" (set on success)
  jira_issue_url TEXT,             -- Full URL to the Jira issue
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- RLS policies for both tables (user owns project)
```

### Files to Create/Modify
- `app/supabase/migrations/YYYYMMDD_add_jira_integrations.sql`
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

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/jira/auth` | GET | Generate OAuth URL, redirect user |
| `/api/integrations/jira/callback` | GET | Handle OAuth callback, exchange code |
| `/api/integrations/jira/[projectId]` | GET | Get integration status for project |
| `/api/integrations/jira/[projectId]` | DELETE | Disconnect integration |
| `/api/integrations/jira/[projectId]/projects` | GET | List Jira projects user can access |
| `/api/integrations/jira/[projectId]/configure` | POST | Save project/issue type selection |

### Service Layer

```typescript
// app/src/lib/jira/oauth.ts
export async function generateAuthUrl(projectId: string, userId: string): Promise<string>
export async function exchangeCodeForTokens(code: string): Promise<JiraTokens>
export async function refreshAccessToken(integration: JiraIntegration): Promise<JiraTokens>

// app/src/lib/jira/client.ts
export async function getAccessibleResources(accessToken: string): Promise<JiraResource[]>
export async function getProjects(cloudId: string, accessToken: string): Promise<JiraProject[]>
export async function getIssueTypes(cloudId: string, projectKey: string, accessToken: string): Promise<JiraIssueType[]>
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
2. Check if project has active Jira integration
   ↓
3. Insert row in jira_sync_jobs (action='create', status='pending')
   ↓
4. Cron job picks up pending jobs
   ↓
5. Create Jira ticket via API:
   - Summary: issue.title
   - Description: issue.description + "\n\n---\nView in Hissuno: {link}"
   - Issue Type: from integration config
   ↓
6. Update jira_sync_jobs with jira_issue_key, jira_issue_url, status='completed'
```

### Spec Generated → Update Jira Ticket

```
1. Spec generation completes (product_spec saved to issue)
   ↓
2. Check if issue has associated jira_issue_key
   ↓
3. Insert row in jira_sync_jobs (action='update_spec', status='pending')
   ↓
4. Cron job picks up pending jobs
   ↓
5. Add comment to Jira ticket:
   "📋 Product spec generated. View full spec: {link}"
   ↓
6. Update jira_sync_jobs with status='completed'
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/jira/sync` | POST | Cron endpoint - process pending jobs |
| `/api/issues/[id]/jira-status` | GET | Get sync status for an issue |

### Service Layer

```typescript
// app/src/lib/jira/sync.ts
export async function createJiraTicket(issue: Issue, integration: JiraIntegration): Promise<JiraTicketResult>
export async function addSpecComment(jiraIssueKey: string, specUrl: string, integration: JiraIntegration): Promise<void>
export async function processPendingSyncJobs(): Promise<SyncResult>

// app/src/lib/jira/client.ts
export async function createIssue(cloudId: string, payload: CreateIssuePayload, accessToken: string): Promise<JiraIssue>
export async function addComment(cloudId: string, issueKey: string, comment: string, accessToken: string): Promise<void>
```

### Trigger Points (modify existing code)

1. **Issue creation** - `app/src/lib/supabase/issues.ts` → `createManualIssue()`
2. **PM agent issue creation** - `app/src/mastra/tools/issue-tools.ts` → after issue insert
3. **Spec generation complete** - `app/src/lib/issues/spec-generation-service.ts` → after spec saved

---

## Phase 4: UI Components

### Integration Setup (in Project Settings)

Location: `app/src/components/projects/shared/wizard/steps/issues-step/integrations-section.tsx`

Current state: Shows Jira as "Coming Soon"

New flow:
1. **Disconnected state**: "Connect Jira" button
2. **OAuth in progress**: Loading state
3. **Select project**: Dropdown to pick Jira project + issue type
4. **Connected state**: Show connected project, "Disconnect" button

### Issue Detail View

Location: `app/src/components/issues/issue-detail.tsx` (or similar)

Add:
- Jira ticket link badge (if synced)
- Sync status indicator (pending/syncing/synced/failed)
- Manual "Retry sync" button if failed

### New Components

```
app/src/components/integrations/
├── jira/
│   ├── jira-connect-button.tsx
│   ├── jira-project-selector.tsx
│   ├── jira-status-badge.tsx
│   └── jira-disconnect-dialog.tsx
```

---

## Phase 5: Cron Job

### Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/integrations/jira/sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Processing Logic

```typescript
// /api/integrations/jira/sync/route.ts
export async function POST(request: Request) {
  // Verify cron secret
  // Fetch pending jobs (limit 10)
  // For each job:
  //   - Refresh token if needed
  //   - Execute action (create or update_spec)
  //   - Update job status
  //   - Handle errors, increment retry_count
  // Return summary
}
```

### Retry Logic

- Max 3 retries
- Jobs with `retry_count >= max_retries` marked as `failed`
- Failed jobs surface in UI for manual retry

---

## Error Handling

| Error Type | Handling |
|------------|----------|
| OAuth token expired | Auto-refresh using refresh_token |
| Jira API rate limit | Exponential backoff, retry in next cron |
| Invalid Jira project | Mark job failed, surface in UI |
| Network error | Retry up to max_retries |
| User revoked access | Mark integration as disconnected |

---

## Files Summary

### New Files
- `app/supabase/migrations/YYYYMMDD_add_jira_integrations.sql`
- `app/src/types/jira.ts`
- `app/src/lib/jira/oauth.ts`
- `app/src/lib/jira/client.ts`
- `app/src/lib/jira/sync.ts`
- `app/src/lib/supabase/jira-integrations.ts`
- `app/src/app/api/integrations/jira/auth/route.ts`
- `app/src/app/api/integrations/jira/callback/route.ts`
- `app/src/app/api/integrations/jira/[projectId]/route.ts`
- `app/src/app/api/integrations/jira/[projectId]/projects/route.ts`
- `app/src/app/api/integrations/jira/[projectId]/configure/route.ts`
- `app/src/app/api/integrations/jira/sync/route.ts`
- `app/src/app/api/issues/[id]/jira-status/route.ts`
- `app/src/components/integrations/jira/*.tsx`
- `app/src/hooks/use-jira-integration.ts`

### Modified Files
- `app/src/lib/supabase/issues.ts` (add sync trigger)
- `app/src/mastra/tools/issue-tools.ts` (add sync trigger)
- `app/src/lib/issues/spec-generation-service.ts` (add sync trigger)
- `app/src/components/projects/shared/wizard/steps/issues-step/integrations-section.tsx`
- `app/src/components/issues/issue-detail.tsx` (add Jira badge)
- `app/vercel.json` (add cron)

---

## Verification

1. **OAuth flow**: Connect Jira, verify tokens stored, verify project selection works
2. **Issue creation sync**: Create issue manually, verify Jira ticket created within 5 min
3. **PM agent sync**: Let PM agent create issue, verify Jira ticket created
4. **Spec update sync**: Generate spec, verify comment added to Jira ticket
5. **Error handling**: Disconnect Jira mid-sync, verify retry and failure states
6. **UI states**: Verify all connection states display correctly

---

## Future: Linear Integration

Once Jira is complete, Linear follows the same pattern:
- `linear_integrations` table (same structure, different fields)
- Linear OAuth flow (simpler than Jira)
- Linear GraphQL API for ticket creation
- Shared UI components with Jira

Consider abstracting common patterns into a shared integration layer when adding Linear.
