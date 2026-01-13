# Code Module Implementation Plan

## Overview

Add a "Code" module to Hissuno that enables AI-driven code generation from issues. The module includes a Coding Agent that reads the codebase, creates execution plans, writes code, and creates GitHub branches/commits/PRs.

**Key Features:**
- Coding Agent with codebase read/write capabilities
- Two approval checkpoints: plan approval and code review
- IDE-like detail view with file tree, diff viewer, and agent chat
- Manual trigger via button + automatic trigger based on criteria

---

## 1. Database Schema

### 1.1 New Table: `code_changes`

```sql
-- Migration: 20260117000000_add_code_changes.sql
CREATE TABLE public.code_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,

  -- Status: pending → planning → awaiting_plan_approval → executing → awaiting_code_review → creating_pr → merged/rejected/failed
  status text NOT NULL DEFAULT 'pending',

  -- Plan
  execution_plan jsonb,
  plan_approved_at timestamptz,
  plan_approved_by uuid REFERENCES auth.users(id),

  -- Git details
  branch_name text,
  base_branch text,
  commit_sha text,
  pr_url text,
  pr_number integer,

  -- File changes: [{path, action, originalContent, newContent, diff}]
  file_changes jsonb,

  -- Iteration conversation
  conversation_messages jsonb DEFAULT '[]',

  -- Review
  code_approved_at timestamptz,
  code_approved_by uuid REFERENCES auth.users(id),
  rejection_reason text,

  -- Tracking
  run_id text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 1.2 Project Settings Additions

```sql
-- Migration: 20260117100000_add_code_settings.sql
ALTER TABLE project_settings ADD COLUMN
  code_github_base_branch text DEFAULT 'main',
  code_guidelines text,
  code_auto_execute_plan boolean DEFAULT false,
  code_auto_create_pr boolean DEFAULT false,
  code_auto_trigger_enabled boolean DEFAULT false,
  code_auto_trigger_threshold integer DEFAULT 5;
```

---

## 2. New Mastra Tools

### 2.1 File Write Tools (`app/src/mastra/tools/code-tools.ts`)

| Tool | Purpose |
|------|---------|
| `write-codebase-file` | Write/create file in cloned repo |
| `delete-codebase-file` | Delete file from cloned repo |

### 2.2 GitHub Tools (`app/src/mastra/tools/github-tools.ts`)

| Tool | Purpose |
|------|---------|
| `create-github-branch` | Create branch from base using GitHub API |
| `commit-files-github` | Commit file changes to branch |
| `create-pull-request` | Create PR on GitHub |

### 2.3 Issue Context Tool (extend `app/src/mastra/tools/issue-tools.ts`)

| Tool | Purpose |
|------|---------|
| `get-issue-for-coding` | Get issue + spec + sessions + codebase info |

---

## 3. Coding Agent

**File:** `app/src/mastra/agents/coding-agent.ts`

**Tools:** All codebase tools (list, read, search, write, delete) + GitHub tools + issue context + web search

**Modes:**
1. **plan** - Analyze issue, explore codebase, generate execution plan JSON
2. **execute** - Create branch, write files based on approved plan
3. **iterate** - Modify code based on user feedback
4. **create_pr** - Create GitHub pull request

**Execution Plan Format:**
```json
{
  "summary": "Brief description",
  "steps": [
    { "id": "step-1", "description": "...", "files": ["path"], "action": "create|modify|delete", "rationale": "..." }
  ],
  "estimatedComplexity": "low|medium|high",
  "risks": ["..."],
  "dependencies": ["..."]
}
```

---

## 4. API Routes

### 4.1 CRUD Routes
- `GET/POST /api/code-changes` - List/create code changes
- `GET/PATCH/DELETE /api/code-changes/[id]` - Single code change

### 4.2 Action Routes
- `POST /api/code-changes/[id]/start-planning` - Start plan generation
- `GET /api/code-changes/[id]/stream` - SSE progress stream
- `POST /api/code-changes/[id]/approve-plan` - Approve execution plan
- `POST /api/code-changes/[id]/reject-plan` - Reject with feedback
- `POST /api/code-changes/[id]/start-execution` - Start code writing
- `POST /api/code-changes/[id]/approve-code` - Approve generated code
- `POST /api/code-changes/[id]/reject-code` - Reject with feedback (iterate)
- `POST /api/code-changes/[id]/create-pr` - Create GitHub PR
- `POST /api/code-changes/[id]/iterate` - Send iteration feedback

### 4.3 Issue Integration
- `POST /api/issues/[id]/generate-code` - Create code change from issue

---

## 5. React Components

### 5.1 Code Changes List Page
```
app/(authenticated)/code/page.tsx
components/code/
  ├── code-changes-page.tsx      # Main page container
  ├── code-changes-filters.tsx   # Project, status, search filters
  └── code-changes-table.tsx     # List table with status badges
```

### 5.2 Code Change Detail (IDE-like)
```
app/(authenticated)/code/[id]/page.tsx
components/code/
  ├── code-change-detail.tsx     # Three-panel layout
  ├── file-tree.tsx              # Left: changed files tree
  ├── diff-viewer.tsx            # Center: Monaco diff viewer
  ├── agent-conversation.tsx     # Right: chat for iterations
  ├── plan-approval-panel.tsx    # Plan review UI
  ├── code-review-panel.tsx      # Code review with approve/reject
  └── status-indicator.tsx       # Progress/status display
```

### 5.3 Issue Sidebar Update
Add "Generate Code" button to `components/issues/issue-sidebar.tsx` (below Product Spec section)

### 5.4 Hooks
```
hooks/
  ├── use-code-changes.ts        # List with filters
  ├── use-code-change-detail.ts  # Single code change
  └── use-code-generation.ts     # SSE streaming hook
```

---

## 6. State Machine

```
pending → planning → awaiting_plan_approval → executing → awaiting_code_review → creating_pr → merged
                            ↓                                     ↓
                        rejected                              (iterate back to executing)
                                                                  ↓
                                                              rejected

On error at any stage: → failed
```

---

## 7. Auto-Trigger Logic

In session review workflow, after issue update:
```typescript
if (settings.code_auto_trigger_enabled &&
    issue.product_spec &&
    (issue.priority === 'high' || issue.upvote_count >= settings.code_auto_trigger_threshold)) {
  // Create code_change and start planning
}
```

---

## 8. Implementation Phases

### Phase 1: Database & Types
1. Create migration `20260117000000_add_code_changes.sql`
2. Create migration `20260117100000_add_code_settings.sql`
3. Run `supabase db push` and regenerate types
4. Add TypeScript types `types/code-change.ts`

### Phase 2: Mastra Tools
1. Create `mastra/tools/code-tools.ts` (write, delete)
2. Create `mastra/tools/github-tools.ts` (branch, commit, PR)
3. Extend `mastra/tools/issue-tools.ts` with `get-issue-for-coding`

### Phase 3: Coding Agent
1. Create `mastra/agents/coding-agent.ts`
2. Register in `mastra/index.ts`
3. Test in Mastra playground

### Phase 4: API Routes
1. Code changes CRUD routes
2. Action routes (start-planning, approve, reject, etc.)
3. SSE streaming route
4. Issue generate-code trigger

### Phase 5: React Components
1. Create hooks
2. Build code-changes list page
3. Build IDE-like detail view
4. Update issue sidebar with "Generate Code" button

### Phase 6: Integration
1. End-to-end testing
2. Auto-trigger integration
3. Error handling polish

---

## 9. Critical Files to Reference

| Pattern | File |
|---------|------|
| SSE streaming | `app/api/issues/[id]/generate-spec/stream/route.ts` |
| Issue sidebar | `components/issues/issue-sidebar.tsx` |
| GitHub API | `lib/integrations/github/index.ts` |
| Codebase tools | `mastra/tools/codebase-tools.ts` |
| List page pattern | `components/issues/issues-page.tsx` |
| Streaming hook | `hooks/use-spec-generation.ts` |

---

## 10. Verification Plan

1. **Database**: Run migrations, verify types generated correctly
2. **Tools**: Test each tool in isolation via Mastra playground
3. **Agent**: Test planning mode with a sample issue
4. **API**: Test each endpoint with curl/Postman
5. **UI**:
   - Verify code changes list loads and filters work
   - Verify "Generate Code" button appears on issues with specs
   - Test full flow: trigger → plan → approve → execute → review → PR
6. **E2E**: Create code change from issue, verify branch and PR created on GitHub
