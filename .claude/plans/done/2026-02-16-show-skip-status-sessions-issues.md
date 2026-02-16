# Show "Skipped" Status on Sessions and Issues

## Context

When a user hits their billing plan's analysis limit, the cron job silently skips session reviews and creates `session_reviews` records with `status: 'skipped'`. However, the UI currently shows these sessions identically to sessions that have never been processed (just a dash in the "Analyzed" column). Users have no way to see which sessions were skipped due to limits, making it impossible to find and retry them after upgrading.

For issues, the analysis limit returns a 429 error with a generic error message (no `LimitReachedDialog` like sessions have), and there's no persistent "skipped" state.

**Goal**: Surface "skipped due to billing limit" status in both sessions and issues tables/sidebars so users can upgrade and retry analysis on skipped items.

---

## Approach: Add `_limit_skipped_at` columns

Add timestamp columns directly to the `sessions` and `issues` tables rather than relying on complex joins to `session_reviews`/`issue_analysis_runs`. This keeps queries fast and the frontend logic simple.

---

## Step 1: Database Migration

**New file**: `app/supabase/migrations/20260214000000_add_limit_skipped_columns.sql`

```sql
ALTER TABLE sessions ADD COLUMN review_limit_skipped_at timestamptz;
ALTER TABLE issues ADD COLUMN analysis_limit_skipped_at timestamptz;
```

**Modify**: `app/src/types/supabase.ts` - Regenerate types after migration

---

## Step 2: Session Backend - Persist Skipped State

### 2a. Cron: Set `review_limit_skipped_at` when auto-skipping

**File**: `app/src/app/api/cron/session-lifecycle/route.ts`
- In `markSessionLimitSkipped()`: Also update the session's `review_limit_skipped_at = NOW()`
- Existing `session_reviews` insert stays as-is (keeps audit trail)

### 2b. Manual review route: Set on 429, clear on success

**File**: `app/src/app/api/projects/[id]/sessions/[sessionId]/review/route.ts`
- In POST handler: When `enforceLimit` throws `LimitExceededError`, set `review_limit_skipped_at = NOW()` on the session before returning 429
- When review record is successfully created (status: 'running'), clear `review_limit_skipped_at = null`

### 2c. Review stream: Clear on completion

**File**: `app/src/app/api/projects/[id]/sessions/[sessionId]/review/stream/route.ts`
- When review completes successfully, `pm_reviewed_at` is set and `review_limit_skipped_at` should be cleared (it's already irrelevant since `pm_reviewed_at` takes precedence, but clean it up)

---

## Step 3: Session Frontend - Display Skipped Status

### 3a. Types

**File**: `app/src/types/session.ts`
- Add `review_limit_skipped_at: string | null` to `SessionRecord`
- Add `isLimitSkipped?: boolean` to `SessionFilters`

### 3b. Sessions table "Analyzed" column

**File**: `app/src/components/sessions/sessions-table.tsx`
- Currently at line 222-244: shows checkmark or dash
- Change to three states:
  - `pm_reviewed_at` set → green checkmark (existing)
  - `review_limit_skipped_at` set AND `pm_reviewed_at` null → orange/warning triangle icon with tooltip "Skipped - plan limit reached"
  - Neither → dash (existing)

### 3c. Sessions filters

**File**: `app/src/components/sessions/sessions-filters.tsx`
- Add "Skipped" filter chip next to existing "Analyzed" chip
- When active, filters for `isLimitSkipped: true`

**File**: `app/src/hooks/use-sessions.ts`
- Pass `isLimitSkipped` filter param to API

**File**: `app/src/app/api/projects/[id]/sessions/route.ts`
- Handle `isLimitSkipped` query param

**File**: `app/src/lib/supabase/sessions.ts`
- Add filter: `.not('review_limit_skipped_at', 'is', null).is('pm_reviewed_at', null)`

### 3d. Session sidebar - skipped banner

**File**: `app/src/hooks/use-session-review.ts`
- Add `isLimitSkipped: boolean` to the hook return state
- When fetching status and `status === 'skipped'` with `result.skipReason` containing "Billing limit", set `isLimitSkipped = true`
- Also expose from session data directly: `session.review_limit_skipped_at && !session.pm_reviewed_at`

**File**: `app/src/components/sessions/session-review/session-review-section.tsx`
- Add a warning banner when the session is limit-skipped (before the linked issues section)
- Banner text: "Analysis was skipped because your plan's analysis limit was reached. Upgrade your plan or click Analyze to retry."
- Style: same warning pattern as `LimitReachedDialog` (orange border, warning icon)
- Include small "Upgrade" link to `/account/billing`

### 3e. Session sidebar - Analyze button visual hint

**File**: `app/src/components/sessions/session-sidebar/session-sidebar.tsx`
- When `review_limit_skipped_at` is set and `pm_reviewed_at` is null, show the Analyze button with warning color (orange) instead of default gray, to draw attention

---

## Step 4: Issue Backend - Persist Skipped State

### 4a. Analyze route: Set `analysis_limit_skipped_at` on 429

**File**: `app/src/app/api/projects/[id]/issues/[issueId]/analyze/route.ts`
- In POST handler: When `enforceLimit` throws `LimitExceededError`, set `analysis_limit_skipped_at = NOW()` on the issue before returning 429

### 4b. Analysis stream: Clear on success

**File**: `app/src/app/api/projects/[id]/issues/[issueId]/analyze/stream/route.ts`
- When analysis completes successfully (`analysis_computed_at` is set), clear `analysis_limit_skipped_at = null`

---

## Step 5: Issue Frontend - Display Skipped Status

### 5a. Types

**File**: `app/src/types/issue.ts`
- Add `analysis_limit_skipped_at: string | null` to issue record type

### 5b. Issues table "Analyzed" column

**File**: `app/src/components/issues/issues-table.tsx`
- Add new "Analyzed" column between existing columns (after "Effort", before "Status")
- Three states:
  - `analysis_computed_at` set → green checkmark
  - `analysis_limit_skipped_at` set AND `analysis_computed_at` null → orange warning icon with tooltip "Skipped - plan limit reached"
  - Neither → dash

### 5c. `useIssueAnalysis` hook - handle 429

**File**: `app/src/hooks/use-issue-analysis.ts`
- Currently doesn't handle 429 specifically (generic error)
- Add `limitError: LimitExceededErrorDetails | null` state (same pattern as `useSessionReview`)
- Detect 429 + `LIMIT_EXCEEDED` code in `startAnalysis`
- Add `clearLimitError()` method
- Return `limitError` and `clearLimitError` from hook

### 5d. Issue sidebar - show `LimitReachedDialog`

**File**: `app/src/components/issues/issue-sidebar.tsx`
- Import `LimitReachedDialog` from `@/components/billing`
- Use `limitError` from `useIssueAnalysis` to show the dialog (same as session sidebar does)
- Pass `dimension="analyzed_issues"` for correct messaging
- Show warning banner when `analysis_limit_skipped_at` is set and `analysis_computed_at` is null

### 5e. Issue sidebar - Analyze button visual hint

- When `analysis_limit_skipped_at` is set and `analysis_computed_at` is null, show warning color on Analyze button

---

## Files to Modify (Summary)

| File | Change |
|------|--------|
| `app/supabase/migrations/20260214000000_add_limit_skipped_columns.sql` | **New** - Add columns |
| `app/src/types/session.ts` | Add `review_limit_skipped_at` field + filter |
| `app/src/types/issue.ts` | Add `analysis_limit_skipped_at` field |
| `app/src/app/api/cron/session-lifecycle/route.ts` | Set `review_limit_skipped_at` in `markSessionLimitSkipped` |
| `app/src/app/api/projects/[id]/sessions/[sessionId]/review/route.ts` | Set/clear `review_limit_skipped_at` |
| `app/src/app/api/projects/[id]/issues/[issueId]/analyze/route.ts` | Set `analysis_limit_skipped_at` on 429 |
| `app/src/components/sessions/sessions-table.tsx` | Show skipped icon in Analyzed column |
| `app/src/components/sessions/sessions-filters.tsx` | Add "Skipped" filter |
| `app/src/components/sessions/session-review/session-review-section.tsx` | Add skipped banner |
| `app/src/components/sessions/session-sidebar/session-sidebar.tsx` | Warning color on Analyze button |
| `app/src/components/issues/issues-table.tsx` | Add "Analyzed" column with skip state |
| `app/src/components/issues/issue-sidebar.tsx` | Add `LimitReachedDialog` + skipped banner |
| `app/src/hooks/use-session-review.ts` | Surface `isLimitSkipped` state |
| `app/src/hooks/use-issue-analysis.ts` | Handle 429 + `limitError` state |
| `app/src/hooks/use-sessions.ts` | Pass `isLimitSkipped` filter |
| `app/src/lib/supabase/sessions.ts` | Handle `isLimitSkipped` filter in query |
| `app/src/app/api/projects/[id]/sessions/route.ts` | Accept `isLimitSkipped` param |

---

## Verification

1. **Session auto-skip**: Simulate cron with a session at limit → verify sessions table shows orange warning icon
2. **Session manual skip**: Click "Analyze" on session when at limit → verify 429 shows `LimitReachedDialog` AND session table shows warning icon
3. **Session retry**: After "upgrading" (increasing limit), click "Analyze" on a skipped session → verify analysis runs and checkmark replaces warning icon
4. **Session filter**: Toggle "Skipped" filter → verify only limit-skipped sessions appear
5. **Issue manual skip**: Click "Analyze" on issue when at limit → verify `LimitReachedDialog` appears AND issues table shows warning icon in Analyzed column
6. **Issue retry**: After increasing limit, click "Analyze" → verify analysis runs and checkmark replaces warning icon
7. **Run tests**: `cd app && npm run test`
