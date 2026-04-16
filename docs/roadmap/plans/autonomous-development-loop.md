# Autonomous Development Loop

## Context

Hissuno already handles feedback ingestion, issue creation, RICE prioritization, brief generation, and knowledge management. The goal is to close the loop: after a brief is generated, automatically trigger Claude Code to implement the feature, create a PR, validate via CI, and track the full lifecycle back to issue resolution.

The first target project is game-shelter (AI game-building platform for kids). The system should be generic enough to work with any GitHub-hosted project.

**What works today:** Feedback -> Sessions -> Issues -> RICE scores -> Briefs. This pipeline is complete.

**The gap:** After a brief is generated, the loop stops. There is no bridge from "issue with a brief" to "code change in a PR."

---

## Architecture

```
                    +-------------------------------------+
                    |         HISSUNO (orchestrator)       |
                    |                                      |
  Feedback ------>  |  Session -> Issue -> RICE -> Brief   |
  (widget/GH/slack) |           |                          |
                    |           v                          |
                    |  Development Orchestrator (cron)     |
                    |    - picks highest RICE issue        |
                    |    - checks approval gate            |
                    |           |                          |
                    |           v                          |
                    |  Development Workflow (Mastra)       |
                    |    1. Create branch (GitHub API)     |
                    |    2. Dispatch GH Action             |
                    |    3. Monitor progress               |
                    |           |                          |
                    +-----------|--------------------------+
                                |
                    +-----------v--------------------------+
                    |      TARGET REPO (e.g. game-shelter) |
                    |                                      |
                    |  GH Action: hissuno-develop.yml      |
                    |    1. Checkout branch                 |
                    |    2. Claude Code CLI + brief         |
                    |    3. Commit + push                   |
                    |    4. Create PR                       |
                    |           |                          |
                    |  GH Action: ci.yml                   |
                    |    1. Lint  2. Typecheck  3. Build   |
                    |           |                          |
                    |  PR merge (human gate) -> deploy     |
                    +-----------|--------------------------+
                                |
                    +-----------v--------------------------+
                    |  GitHub webhook -> Hissuno           |
                    |    - PR merged -> issue resolved     |
                    |    - Re-analyze codebase knowledge   |
                    |    - Notify linked contacts          |
                    |    - Orchestrator picks next issue   |
                    +-------------------------------------+
```

---

## Gap Analysis

| # | Gap | Severity | Description |
|---|-----|----------|-------------|
| 1 | Issue -> Development bridge | CRITICAL | No workflow to take a brief and trigger Claude Code |
| 2 | GitHub write operations | CRITICAL | `app-client.ts` only reads. No branch creation, PR creation, or workflow dispatch |
| 3 | Development run tracking | CRITICAL | No table to track development lifecycle |
| 4 | CI/CD on target repo | HIGH | Target repos need CI pipelines and a Claude Code GH Action |
| 5 | Orchestrator | HIGH | Nothing decides WHEN to start the next development cycle |
| 6 | PR merge -> issue closure | MEDIUM | No webhook handler for PR merge events |
| 7 | Feedback collection | MEDIUM | Target repos need widget embed or support channel |
| 8 | Codebase knowledge | LOW | Config only - connect target repo as knowledge source |

### What exists and just needs wiring

- `ready_for_dev` notification type exists (inactive) - `app/src/types/notification-preferences.ts:9`
- Issue `status` field is freeform text - already supports any status value
- GitHub App installation + token generation works - `app/src/lib/integrations/github/`
- CLI exposes `hissuno ask` - Claude Code can query Hissuno for context during development
- Fire-and-forget workflow pattern established - `app/src/lib/utils/session-processing.ts`
- Mastra workflow infrastructure is mature (4 existing workflows)

---

## Implementation Plan

### Phase 1: The Bridge (Hissuno -> Claude Code -> PR)

Minimal set to close the loop. One human gate: PR review on GitHub.

#### 1.1 Extend GitHub API Client

**File:** `app/src/lib/integrations/github/app-client.ts`

Add write operations following the existing pattern:

- `createBranch(token, owner, repo, branchName, baseSha)` - POST `/repos/{owner}/{repo}/git/refs`
- `getDefaultBranchSha(token, owner, repo)` - GET `/repos/{owner}/{repo}/git/ref/heads/{branch}`
- `createPullRequest(token, owner, repo, { title, body, head, base })` - POST `/repos/{owner}/{repo}/pulls`
- `triggerWorkflowDispatch(token, owner, repo, workflowFile, ref, inputs)` - POST `/repos/{owner}/{repo}/actions/workflows/{workflow}/dispatches`
- `getWorkflowRuns(token, owner, repo, { branch?, event? })` - GET `/repos/{owner}/{repo}/actions/runs`
- `getWorkflowRun(token, owner, repo, runId)` - GET `/repos/{owner}/{repo}/actions/runs/{runId}`

#### 1.2 Development Runs Table

**File:** `app/src/lib/db/schema/app.ts`

```
developmentRuns:
  id: uuid PK
  issue_id: uuid FK -> issues
  project_id: uuid FK -> projects
  status: text (pending | branch_created | dispatched | coding | pr_created | ci_passing | ci_failing | merged | failed | cancelled)
  github_owner: text
  github_repo: text
  github_branch: text
  github_pr_number: integer
  github_pr_url: text
  github_actions_run_id: text
  error_message: text
  brief_snapshot: text (frozen copy of the brief used)
  started_at: timestamp
  completed_at: timestamp
  created_at: timestamp
  updated_at: timestamp
```

#### 1.3 Project Settings Extension

**File:** `app/src/lib/db/schema/app.ts` (extend `projectSettings`)

New columns:
- `auto_development_enabled` boolean default false
- `development_approval_mode` text default 'approval_required'
- `development_priority_threshold` doublePrecision nullable
- `development_max_concurrent` integer default 1
- `development_github_owner` text
- `development_github_repo` text
- `development_github_base_branch` text default 'main'
- `development_github_workflow` text default 'hissuno-develop.yml'

#### 1.4 Development Service

**New file:** `app/src/lib/development/development-service.ts`

Following the `issues-service.ts` pattern:
- `triggerDevelopment(issueId, projectId)` - creates run, calls workflow
- `getDevelopmentRun(issueId)` - returns active run
- `cancelDevelopment(runId)` - sets status to cancelled
- `updateRunStatus(runId, status, metadata)` - status transitions

#### 1.5 Development Workflow (Mastra)

**New directory:** `app/src/mastra/workflows/development/`

Steps:
1. **validate-readiness** - Issue has brief, status is ready, no active dev run, project has dev settings
2. **prepare-branch** - Get default branch SHA, create `hissuno/issue-{id}-{slug}` branch via GitHub API
3. **dispatch-claude-code** - Trigger workflow dispatch on target repo with inputs: `{ issue_id, brief, branch_name }`
4. **monitor-execution** - Poll GH Actions run status (with backoff). Update development_run status.
5. **finalize** - When GH Action completes: if PR exists, update status to `pr_created`. If failed, set `failed` + error.

Fire-and-forget trigger: `fireDevelopment(issueId, projectId)` in `app/src/lib/utils/development.ts`

#### 1.6 Development Orchestrator Cron

**New file:** `app/src/app/api/(system)/cron/development-orchestrator/route.ts`

Runs every 30 minutes. For each project with `auto_development_enabled`:
1. Check active development runs < `development_max_concurrent`
2. Query issues: status = 'ready', has brief, RICE score >= threshold, ordered by RICE desc
3. If `approval_mode = 'auto'`: trigger development immediately
4. If `approval_mode = 'approval_required'`: create notification and wait for human approval

#### 1.7 Development Monitor Cron

**New file:** `app/src/app/api/(system)/cron/development-monitor/route.ts`

Runs every 5 minutes. For each active development run:
1. Poll GitHub Actions run status
2. Update development run status accordingly
3. Handle failures with error capture

### Phase 2: Target Repo Setup (game-shelter)

#### 2.1 Claude Code GitHub Action

**New file (target repo):** `.github/workflows/hissuno-develop.yml`

Workflow dispatch accepting `issue_id`, `brief`, `branch_name`. Runs Claude Code CLI with the brief, commits, pushes, creates PR.

#### 2.2 CI Pipeline

**New file (target repo):** `.github/workflows/ci.yml`

PR validation: lint, typecheck, build.

#### 2.3 CLAUDE.md

Architecture decisions, conventions, CLI config pointing to Hissuno for product context.

#### 2.4 Widget Embed

Add Hissuno widget to the target repo's layout for feedback collection.

### Phase 3: Close the Loop

#### 3.1 GitHub Webhook Handler

**New file:** `app/src/app/api/(system)/webhooks/github/route.ts`

Handle PR merge: update run status, resolve issue, refresh codebase knowledge, notify contacts.

#### 3.2 Notifications

Activate `ready_for_dev`. Add `development_started`, `development_completed`, `issue_resolved` types.

#### 3.3 API Routes

- `POST /api/issues/[issueId]/develop` - manually trigger development
- `GET /api/development` - list runs
- `GET/POST /api/development/[runId]` - status + cancel

---

## Safety Mechanisms

1. **Human PR review gate** - PRs are never auto-merged in Phase 1
2. **Approval mode** - Default `approval_required` (human approves before dev starts)
3. **Concurrency limit** - Default max 1 concurrent run per project
4. **Priority threshold** - Only issues above configurable RICE score
5. **Brief snapshot** - Frozen copy at trigger time
6. **CI gate** - Must pass lint + typecheck + build
7. **Cancellation** - Any active run can be cancelled
8. **Error isolation** - Failed runs don't block next issue

---

## Verification

1. **Unit:** development-service functions, GitHub API client new methods
2. **Integration:** Issue with brief -> trigger development -> branch created -> GH Action dispatched
3. **E2E:** Full loop - feedback -> issue -> brief -> development -> PR -> CI -> merge -> resolved
4. **Manual:** Claude Code receives brief correctly, CLI bridge works, notifications fire

---

## Critical Files

| Purpose | Path |
|---------|------|
| GitHub API client (extend) | `app/src/lib/integrations/github/app-client.ts` |
| Schema (add table + settings) | `app/src/lib/db/schema/app.ts` |
| Relations (add) | `app/src/lib/db/schema/relations.ts` |
| Development service (new) | `app/src/lib/development/development-service.ts` |
| Development workflow (new) | `app/src/mastra/workflows/development/` |
| Fire-and-forget trigger (new) | `app/src/lib/utils/development.ts` |
| Orchestrator cron (new) | `app/src/app/api/(system)/cron/development-orchestrator/route.ts` |
| Monitor cron (new) | `app/src/app/api/(system)/cron/development-monitor/route.ts` |
| GH webhook handler (new) | `app/src/app/api/(system)/webhooks/github/route.ts` |
| Notification types (extend) | `app/src/types/notification-preferences.ts` |

## Reusable Infrastructure

- **Mastra workflow engine** - `createRunAsync()` pattern from `issue-analysis/`
- **GitHub token generation** - `getGitHubInstallationToken()` from `app/src/lib/integrations/github/`
- **Fire-and-forget pattern** - from `app/src/lib/utils/session-processing.ts`
- **Cron route pattern** - Bearer token auth from existing cron routes
- **Notification system** - `app/src/lib/notifications/`
- **Graph eval trigger** - `fireGraphEval()` for post-merge knowledge refresh
