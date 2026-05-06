---
name: linear-issues
description: >
  Sync issues from a Linear team into Hissuno. Runs incrementally on a
  schedule, advances a per-team cursor in automation_skill_state, and
  registers external→hissuno id mappings so subsequent runs skip
  already-synced issues.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
  scheduled: { cron: '0 */6 * * *' }
capabilities:
  sandbox: true
  webSearch: false
requires:
  plugins: [linear]
input:
  teamId:
    type: string
    required: true
    description: Linear team id to sync issues from.
timeoutMs: 1200000
---

# Linear Issues Sync

Pulls issues from one Linear team into Hissuno's `issues` resource.

## What this skill does

1. Reads the team id from `HISSUNO_RUN_INPUT.teamId`.
2. Loads the cursor (`updatedAtSince`) from `automation_skill_state` for this skill, keyed by team id.
3. Queries the Linear GraphQL API for issues in the team updated since the cursor (paginated).
4. For each issue, posts to `/api/issues` with `external_id` + `external_source = 'linear'` so the resource POST endpoint registers the external→hissuno mapping.
5. Saves the new cursor (max `updatedAt` from this run) back to `automation_skill_state`.

## How to run

```bash
tsx scripts/sync.ts
```

The script expects these env vars (the sandbox harness injects them):

- `LINEAR_ACCESS_TOKEN` — provided by `requires.plugins: [linear]`
- `HISSUNO_API_KEY`, `HISSUNO_PROJECT_ID`, `HISSUNO_RUN_INPUT`, `HISSUNO_SKILL_ID`
- `HISSUNO_BASE_URL` — defaults to `http://localhost:3000` if absent

When the script finishes, write a one-line JSON summary to `output.json`:

```json
{ "synced": 12, "skipped": 4, "cursor": "2026-05-06T12:00:00Z" }
```

That summary becomes `automation_runs.output`.
