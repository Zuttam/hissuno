# CLI & MCP Feature Parity Uplift

Close the feature gap between Hissuno's web UI and its programmatic interfaces (CLI + MCP). AI agents use CLI and MCP interchangeably - both need full parity so an agent can do everything a human can in the dashboard (except settings/admin/analytics).

**After**: CLI goes from 8 to 13 commands. MCP goes from 6 to ~17 tools.

---

## Current State

### CLI (`@hissuno/cli`) - 8 commands
`init`, `setup`, `types`, `list`, `get`, `search`, `add`, `integrate`

### MCP Server - 6 tools
`ask_hissuno`, `list_resource_types`, `list_resources`, `get_resource`, `search_resources`, `add_resource`

### Key Gaps (both)
- No update operations (can't change issue status/priority, session tags, contact info)
- No archive operations
- No AI workflow triggers (session review, issue analysis)
- No companies CRUD (only knowledge/feedback/issues/contacts)
- No batch operations

### Additional Gaps
- CLI missing: conversational `ask` command, `update`, `delete`, `analyze`, `review`
- MCP missing: integration management, update/archive tools, workflow triggers

---

## Phase 1: Companies Support

Add `companies` as a fifth resource type to both CLI and MCP.

**CLI**: Extend `list.ts`, `get.ts`, `add.ts`, `search.ts`, `output.ts` with companies type maps and formatters.

**MCP**: New `app/src/mcp/resources/companies.ts` adapter. Add to `RESOURCE_TYPES` in `types.ts`. Update `resource-tools.ts` adapters map and docs.

**Reuses**: `listCompanies()`, `insertCompany()`, `updateCompanyById()`, `updateCompanyArchiveStatus()` from `app/src/lib/db/queries/companies.ts`.

---

## Phase 2: Update Operations

**CLI**: New `app/packages/cli/src/commands/update.ts` - `hissuno update <type> <id> [--field value]`. Supports issues, feedback, contacts, companies with type-specific flags. Interactive mode if no flags provided.

**MCP**: New `app/src/mcp/mutation-tools.ts` with 4 type-specific tools: `update_issue`, `update_feedback`, `update_contact`, `update_company`. Explicit input schemas per type (not generic `z.record()`). All reject contact mode.

**Reuses**: `updateIssueById()`, `updateSession()`/`updateSessionTags()`, `updateContactById()`, `updateCompanyById()` from DB query files.

---

## Phase 3: Archive Operations

**CLI**: New `app/packages/cli/src/commands/archive.ts` - `hissuno archive <type> <id> [--unarchive] [--batch id1,id2] [--yes]`. Batch supported for issues + feedback only.

**MCP**: Extend `mutation-tools.ts` with `archive_resource` (generic) and `batch_archive` (issues + feedback). Same archive functions, reject contact mode.

---

## Phase 4: AI Workflow Triggers

**CLI**: Two new commands:
- `hissuno review <sessionId>` - trigger PM review, poll every 3s with spinner, show results. `--no-wait` flag.
- `hissuno analyze <issueId>` - trigger issue analysis, poll with spinner, show RICE scores + brief. `--no-wait` flag.

**MCP**: New `app/src/mcp/workflow-tools.ts` with 4 tools:
- `review_feedback` / `analyze_issue` - fire-and-forget triggers, return `{ status: 'processing', runId }`
- `get_review_status` / `get_analysis_status` - check completion, return results

**Reuses**: `triggerIssueAnalysis()` and `getIssueAnalysisStatus()` from `app/src/lib/issues/analysis-service.ts`. Session review trigger logic from review route handler.

---

## Phase 5: CLI `ask` Command

New API route `app/src/app/api/(project)/agent/ask/route.ts` - mirrors MCP `ask_hissuno` over REST.

New CLI command `app/packages/cli/src/commands/ask.ts` - `hissuno ask "question"` with `--thread-id` for continuity.

**Reuses**: `resolveAgent()` from `app/src/mastra/agents/router.ts`, RuntimeContext pattern from `app/src/mcp/tools.ts`.

---

## Phase 6: MCP Integration Management

New `app/src/mcp/integration-tools.ts` with 3 tools:
- `list_integrations` - status table for all 7 platforms
- `get_integration_status` - detailed status per platform
- `trigger_sync` - trigger sync for Intercom/Gong/Zendesk

No OAuth connect/disconnect via MCP (requires browser). CLI already has full integration management via `integrate` command.

---

## New Files (10)

| File | Phase |
|------|-------|
| `app/src/mcp/resources/companies.ts` | 1 |
| `app/packages/cli/src/commands/update.ts` | 2 |
| `app/src/mcp/mutation-tools.ts` | 2+3 |
| `app/packages/cli/src/commands/archive.ts` | 3 |
| `app/packages/cli/src/commands/review.ts` | 4 |
| `app/packages/cli/src/commands/analyze.ts` | 4 |
| `app/src/mcp/workflow-tools.ts` | 4 |
| `app/packages/cli/src/commands/ask.ts` | 5 |
| `app/src/app/api/(project)/agent/ask/route.ts` | 5 |
| `app/src/mcp/integration-tools.ts` | 6 |

## Modified Files (9)

| File | Phase | Change |
|------|-------|--------|
| `app/packages/cli/src/index.ts` | All | Register 5 new commands |
| `app/packages/cli/src/commands/list.ts` | 1 | Add companies type + filters |
| `app/packages/cli/src/commands/get.ts` | 1 | Add companies type |
| `app/packages/cli/src/commands/add.ts` | 1 | Add companies interactive flow |
| `app/packages/cli/src/commands/search.ts` | 1 | Add companies to valid types |
| `app/packages/cli/src/lib/output.ts` | 1 | Add company formatters |
| `app/src/mcp/resources/types.ts` | 1 | Add 'companies' to RESOURCE_TYPES |
| `app/src/mcp/tools.ts` | 2-6 | Register mutation, workflow, integration tools |
| `app/src/mcp/resource-tools.ts` | 1 | Add companies adapter + update docs |
