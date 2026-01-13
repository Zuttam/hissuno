# Plan: Manual Creation & Archive for Sessions/Issues

## Summary
Add manual creation forms and archive functionality for sessions and issues.

**Key decisions:**
- Use `is_archived` boolean field (items can be archived in any status)
- Add new `'manual'` session source type
- Hidden by default with "Show archived" toggle in filters

---

## Phase 1: Database & Types

### 1.1 Migration: Add `is_archived` columns
**New file:** `app/supabase/migrations/YYYYMMDDHHMMSS_add_archive_and_manual_source.sql`
- Add `is_archived boolean DEFAULT false NOT NULL` to `sessions` and `issues` tables
- Add indexes for efficient filtering
- Document `manual` source in session `source` column comment

### 1.2 Update Types
**File:** `app/src/types/session.ts`
- Add `'manual'` to `SessionSource` type
- Add `manual` entry to `SESSION_SOURCE_INFO` (variant: 'default')
- Add `is_archived: boolean` to `SessionRecord`
- Add `showArchived?: boolean` to `SessionFilters`
- Add `CreateSessionInput` interface

**File:** `app/src/types/issue.ts`
- Add `is_archived: boolean` to `IssueRecord`
- Add `showArchived?: boolean` to `IssueFilters`
- Make `session_id` optional in `CreateIssueInput`

---

## Phase 2: Database Layer

### 2.1 Sessions Database
**File:** `app/src/lib/supabase/sessions.ts`
- Update `listSessions`: filter `is_archived=false` by default, include if `showArchived=true`
- Add `createManualSession(input: CreateSessionInput)` function
- Add `updateSessionArchiveStatus(sessionId, isArchived)` function

### 2.2 Issues Database
**File:** `app/src/lib/supabase/issues.ts`
- Update `listIssues`: filter `is_archived=false` by default
- Add `createManualIssue(input: CreateIssueInput)` function
- Add `updateIssueArchiveStatus(issueId, isArchived)` function

---

## Phase 3: API Routes

### 3.1 Sessions API
**File:** `app/src/app/api/sessions/route.ts`
- Add `showArchived` query param to GET
- Add POST handler for manual session creation

**New file:** `app/src/app/api/sessions/[id]/archive/route.ts`
- PATCH handler to toggle `is_archived`

### 3.2 Issues API
**File:** `app/src/app/api/issues/route.ts`
- Add `showArchived` query param to GET
- Add POST handler for manual issue creation

**New file:** `app/src/app/api/issues/[id]/archive/route.ts`
- PATCH handler to toggle `is_archived`

---

## Phase 4: Hooks

**File:** `app/src/hooks/use-sessions.ts`
- Add `showArchived` to URL params in fetch
- Add `createSession` mutation function
- Add `archiveSession` mutation function

**File:** `app/src/hooks/use-issues.ts`
- Add `showArchived` to URL params in fetch
- Add `createIssue` mutation function
- Add `archiveIssue` mutation function

---

## Phase 5: UI Components

### 5.1 Dialog Component
**New file:** `app/src/components/ui/dialog.tsx`
- Reusable modal dialog using existing backdrop pattern from `session-sidebar.tsx`
- Props: `open`, `onClose`, `title`, `children`

**Update:** `app/src/components/ui/index.ts` - export Dialog

### 5.2 Plus Icon
**New file:** `app/src/components/ui/plus-icon.tsx`
- Simple SVG plus icon component

### 5.3 Create Session Dialog
**New file:** `app/src/components/sessions/create-session-dialog.tsx`
- Form fields: Project (select), User ID (optional), Page URL (optional), Page Title (optional)
- Uses existing brutalist styling patterns

### 5.4 Create Issue Dialog
**New file:** `app/src/components/issues/create-issue-dialog.tsx`
- Form fields: Project (select), Type (select), Title (input), Description (textarea), Priority (select)

### 5.5 Update Sessions Page
**File:** `app/src/components/sessions/sessions-page.tsx`
- Add Create button (IconButton with PlusIcon) in header next to Refresh
- Add dialog state and render `CreateSessionDialog`

### 5.6 Update Issues Page
**File:** `app/src/components/issues/issues-page.tsx`
- Same pattern as sessions - add Create button and dialog

### 5.7 Update Filters
**File:** `app/src/components/sessions/sessions-filters.tsx`
- Add "Show archived" checkbox (use existing Checkbox component)

**File:** `app/src/components/issues/issues-filters.tsx`
- Same - add "Show archived" checkbox

### 5.8 Archive Button in Sidebars
**File:** `app/src/components/sessions/session-sidebar.tsx`
- Add Archive/Unarchive button in SessionDetails section

**File:** `app/src/components/issues/issue-sidebar.tsx`
- Add Archive/Unarchive button

### 5.9 Visual Indicators for Archived Items
**File:** `app/src/components/sessions/sessions-table.tsx`
- Add opacity/strikethrough styling for archived rows
- Show "Archived" badge

**File:** `app/src/components/issues/issues-table.tsx`
- Same visual treatment

---

## Phase 6: Tests

### 6.1 Unit Tests
**New file:** `app/src/__tests__/unit/sessions-archive.test.ts`
- Test archive filtering in listSessions
- Test createManualSession
- Test updateSessionArchiveStatus

**New file:** `app/src/__tests__/unit/issues-archive.test.ts`
- Test archive filtering in listIssues
- Test createManualIssue
- Test updateIssueArchiveStatus

### 6.2 Component Tests
**New file:** `app/src/components/sessions/create-session-dialog.test.tsx`
- Test form rendering and validation
- Test successful creation flow

**New file:** `app/src/components/issues/create-issue-dialog.test.tsx`
- Test form rendering and validation
- Test successful creation flow

### 6.3 Integration Tests
**New file:** `app/src/__tests__/integration/manual-creation.integration.test.ts`
- Test manual session/issue creation via API
- Test archive/unarchive via API
- Test filter behavior with archived items

---

## Implementation Order

1. **Database** - Migration for `is_archived` columns
2. **Types** - Update SessionSource, add is_archived to records, update filters
3. **DB Layer** - Update list functions with archive filter, add create/archive functions
4. **API Routes** - Add showArchived param, POST handlers, archive endpoints
5. **Hooks** - Add showArchived, create, archive functions
6. **UI Components** - Dialog, PlusIcon, CreateSessionDialog, CreateIssueDialog
7. **Page Updates** - Add create buttons, dialogs to pages
8. **Filters** - Add "Show archived" checkbox
9. **Sidebars** - Add archive buttons
10. **Tables** - Add archived visual indicators
11. **Tests** - Unit, component, and integration tests

---

## Critical Files

| Purpose | File Path |
|---------|-----------|
| Session types | `app/src/types/session.ts` |
| Issue types | `app/src/types/issue.ts` |
| Sessions DB | `app/src/lib/supabase/sessions.ts` |
| Issues DB | `app/src/lib/supabase/issues.ts` |
| Sessions API | `app/src/app/api/sessions/route.ts` |
| Issues API | `app/src/app/api/issues/route.ts` |
| Sessions hook | `app/src/hooks/use-sessions.ts` |
| Issues hook | `app/src/hooks/use-issues.ts` |
| Sessions page | `app/src/components/sessions/sessions-page.tsx` |
| Issues page | `app/src/components/issues/issues-page.tsx` |
| Session sidebar | `app/src/components/sessions/session-sidebar.tsx` |
| Issue sidebar | `app/src/components/issues/issue-sidebar.tsx` |
| Sessions filters | `app/src/components/sessions/sessions-filters.tsx` |
| Issues filters | `app/src/components/issues/issues-filters.tsx` |
| Sessions table | `app/src/components/sessions/sessions-table.tsx` |
| Issues table | `app/src/components/issues/issues-table.tsx` |
