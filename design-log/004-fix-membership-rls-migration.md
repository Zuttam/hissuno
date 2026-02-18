# Design Log #004: Fix Membership-Based RLS Migration

## Background
Migration `20260217000000_add_project_members_and_api_keys.sql` replaced single-owner RLS policies (`user_id = auth.uid()`) with membership-based checks (`user_has_project_access(project_id, auth.uid())`). Several code paths were not updated to work with the new model.

## Problem
Three categories of breakage:
1. **~45 route handlers** use `createClient()` (cookie-based, no JWT for API keys) instead of `getClientForIdentity(identity)` (which returns admin client for API keys). API key requests fail silently.
2. **Demo project route** has no `addProjectMember()` call, so the SELECT after INSERT fails and all demo data population fails.
3. **22 integration authz checks** use `project.user_id !== user.id` instead of membership-based checks, blocking non-owner team members.

## Design

### Fix 1: Replace `createClient()` with `getClientForIdentity(identity)` in all project-scoped routes

`getClientForIdentity()` already exists in `@/lib/auth/authorization.ts`:
- User requests: returns cookie-based client (RLS via `auth.uid()`)
- API key requests: returns admin client (bypasses RLS, auth verified by proxy)

Mechanical replacement in every route that uses `requireRequestIdentity()` + `createClient()`:
```typescript
// Before
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
const supabase = await createClient()

// After
import { getClientForIdentity } from '@/lib/auth/authorization'
import { isSupabaseConfigured } from '@/lib/supabase/server'  // if still needed
const supabase = await getClientForIdentity(identity)
```

### Fix 2: Demo project route

- Use `createAdminClient()` for the project insert (same fix as main project creation)
- Add `addProjectMember()` after project creation
- Pass admin client to `createDemoProjectData()`

### Fix 3: Integration authorization

Replace `project.user_id !== user.id` with `hasProjectAccess(projectId, user.id)` from `@/lib/auth/project-members`.

### File Changes

**Category 1** (~30 files under `app/src/app/api/projects/[id]/`):
All route files that import `createClient` and `requireRequestIdentity`

**Category 2** (1 file):
`app/src/app/api/projects/demo/route.ts`

**Category 3** (~18 files under `app/src/app/api/integrations/`):
All files containing `project.user_id !== user.id`

## Implementation Plan

### Phase 1: Category 1 - Project routes (parallel agents)
- Agent A: sessions, issues, members, api-keys, keys, rotate-keys, dashboard, demo-sessions, project [id] root
- Agent B: knowledge, customers, settings

### Phase 2: Category 2 - Demo route

### Phase 3: Category 3 - Integration routes

---

## Implementation Results

### Summary

60 files changed, 248 insertions, 195 deletions. Zero type errors. Zero remaining instances of the broken patterns.

| Category | Files | What changed |
|----------|-------|-------------|
| 1: `createClient` -> `getClientForIdentity` | 37 project route files | Replaced cookie-based client with identity-aware client for API key support |
| 1b: `projects/route.ts` (GET + POST) | 1 file | GET uses `createRequestScopedClient`, POST uses `createAdminClient` (bootstrap) |
| 2: Demo project route | 1 file | Added `addProjectMember()`, switched to `createAdminClient`, removed stale `resolveUser()` |
| 3: Integration authz | 22 integration files | Replaced `project.user_id !== user.id` with `hasProjectAccess()` |

### Deviations from Design

- `projects/route.ts` (GET) uses `createRequestScopedClient()` instead of `getClientForIdentity()` because it doesn't call `assertProjectAccess` and needs session validation for project listing.
- `projects/route.ts` (POST) uses `createAdminClient()` directly because project creation is a bootstrap operation (no project_members entry exists yet).
- Agent found and fixed `slack/channels/leave/route.ts` which wasn't in the original audit list.
- Two knowledge route files needed type annotation updates for helper function parameters that referenced `ReturnType<typeof createClient>`.
