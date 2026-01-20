# Account-Level Integrations Refactor

Move integration tokens/connections from project-level to account-level management while keeping project-level configuration.

## Overview

**Current State**: Each project stores its own GitHub installation and Slack token
**Target State**: Account stores tokens once, projects configure how to use them

## Database Changes

### New Table: `user_integrations`

```sql
CREATE TABLE public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('github', 'slack', 'gong', 'intercom', 'jira', 'linear')),

  -- GitHub fields
  github_installation_id bigint,
  github_account_login text,
  github_account_id bigint,
  github_target_type text,

  -- Slack fields
  slack_workspace_id text,
  slack_workspace_name text,
  slack_workspace_domain text,
  slack_bot_token text,
  slack_bot_user_id text,
  slack_scope text,

  -- Common
  installed_by_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(user_id, type)
);
```

### Update `slack_channels`

Add `user_integration_id` column, migrate data, then remove `workspace_token_id`.

### New Table: `project_slack_config` (Per-Project Channel Routing)

```sql
CREATE TABLE public.project_slack_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slack_channel_id text NOT NULL,  -- Slack's channel ID (e.g., C123ABC)
  channel_name text,               -- Display name for UI
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, slack_channel_id)
);
```

This enables per-project Slack channel routing: events from a channel only go to projects that have that channel configured.

### Drop Old Tables (After Migration)

- `github_app_installations`
- `slack_workspace_tokens`

## Migration Strategy

1. Create `user_integrations` table
2. Migrate GitHub installations: dedupe by `(user_id, installation_id)`, take latest
3. Migrate Slack tokens: dedupe by `(user_id, workspace_id)`, take latest
4. Update `slack_channels` FK to `user_integrations`
5. Drop old tables

## API Routes

### New Account Routes

| Route | Purpose |
|-------|---------|
| `GET /api/account/integrations` | List all user integrations |
| `GET /api/account/integrations/github` | GitHub status |
| `DELETE /api/account/integrations/github` | Disconnect GitHub |
| `GET /api/account/integrations/github/connect` | Start OAuth (supports returnTo param) |
| `GET /api/account/integrations/github/callback` | OAuth callback |
| `GET /api/account/integrations/slack` | Slack status |
| `DELETE /api/account/integrations/slack` | Disconnect Slack |
| `GET /api/account/integrations/slack/connect` | Start OAuth |
| `GET /api/account/integrations/slack/callback` | OAuth callback |

### Update Existing Routes

- `/api/integrations/github/repos` - Use account integration instead of project
- `/api/integrations/github/repos/[owner]/[repo]/branches` - Use account integration
- `/api/integrations/slack/channels` - Use account integration

## Service Layer Changes

### `/lib/integrations/account.ts` (New)

```typescript
export async function getUserIntegration(userId: string, type: 'github' | 'slack')
export async function storeUserIntegration(...)
export async function deleteUserIntegration(userId: string, type: string)
```

### `/lib/integrations/github/index.ts` (Modify)

- `hasGitHubInstallation(supabase, userId)` - Change from projectId to userId
- `getGitHubInstallationToken(supabase, userId)` - Change from projectId to userId
- `disconnectGitHub(supabase, userId)` - Only delete from `user_integrations`, **keep project knowledge_sources** (repo/branch config preserved so user can reconnect)
- `storeGitHubInstallation(...)` - Store to `user_integrations` not `github_app_installations`

### `/lib/integrations/slack/index.ts` (Modify)

- `hasSlackIntegration(supabase, userId)` - Change from projectId to userId
- `getSlackBotToken(supabase, userId)` - Change lookup path
- `storeSlackToken(...)` - Store to `user_integrations`
- `getProjectsForSlackChannel(channelId)` - New: lookup which projects have this channel configured (for event routing)

### `/lib/integrations/slack/event-handlers.ts` (Modify)

Event routing logic:
1. Receive event with `workspace_id` and `channel_id`
2. Lookup user via `user_integrations` where `slack_workspace_id = workspace_id`
3. Lookup projects via `project_slack_config` where `slack_channel_id = channel_id` AND project belongs to that user
4. Route event to matching project(s)

## UI Changes

### New: `/account/integrations/page.tsx`

- List connected integrations (GitHub, Slack)
- Connect/Disconnect buttons
- Show account name / workspace name
- Show which projects use each integration

### New: `useAccountIntegrations` hook

```typescript
export function useAccountIntegrations() {
  // Returns { github, slack, isLoading, refresh }
}
```

### Modify: Project Wizard

**Knowledge Step** (`codebase-source.tsx`):
- Check account-level GitHub integration
- If not connected: "Connect GitHub" → OAuth with `returnTo=project-wizard&projectId=xxx&step=knowledge`
- If connected: Show repo/branch selector

**Sessions Step** (`slack-channel.tsx`):
- Check account-level Slack integration
- If not connected: "Connect Slack" → OAuth with `returnTo=project-wizard&projectId=xxx&step=sessions`
- If connected: Show channel selector to configure which channels this project listens to
- Selected channels saved to `project_slack_config` table

### Update Navigation

Add link to `/account/integrations` in user account menu.

## OAuth State Changes

State parameter encodes return context:

```typescript
{
  userId: string
  returnTo: 'account' | 'project-wizard' | 'project-edit'
  projectId?: string  // if returnTo is project-related
  step?: string       // wizard step to return to
  nonce: string
}
```

Callback redirects appropriately based on `returnTo`.

## Critical Files to Modify

1. `app/supabase/migrations/` - New migration file (`user_integrations`, `project_slack_config`, data migration)
2. `app/src/lib/integrations/github/index.ts` - Account-level lookups
3. `app/src/lib/integrations/slack/index.ts` - Account-level lookups
4. `app/src/lib/integrations/slack/event-handlers.ts` - Channel-based routing
5. `app/src/app/api/integrations/github/callback/route.ts` - New state handling
6. `app/src/app/api/integrations/slack/callback/route.ts` - New state handling
7. `app/src/components/projects/shared/wizard/steps/knowledge-step/` - GitHub UI
8. `app/src/components/projects/shared/wizard/steps/sessions-step/` - Slack channel config UI
9. `app/src/components/layout/user-account-menu.tsx` - Add integrations link
10. `app/src/app/(authenticated)/account/integrations/page.tsx` - New page

## Implementation Order

1. **Database**: Create migration with new table + data migration
2. **Types**: Regenerate Supabase types, add TypeScript types
3. **Service Layer**: Create account.ts, update github/slack services
4. **API Routes**: Create account routes, update existing routes
5. **Account UI**: Create integrations page + hook
6. **Wizard UI**: Update to use account-level checks
7. **Cleanup**: Drop old tables after verification

## Verification

1. New user connects GitHub from account settings → appears in `user_integrations`
2. New user connects GitHub from project wizard → redirects back, repo selector works
3. Existing data migrated correctly (check user_integrations after migration)
4. Multiple projects can use same GitHub installation
5. Disconnect from account settings removes from `user_integrations`
6. Slack events still route correctly (via workspace_id → user_id lookup)
