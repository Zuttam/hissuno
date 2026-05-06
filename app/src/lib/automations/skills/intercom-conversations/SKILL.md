---
name: intercom-conversations
description: >
  Sync Intercom conversations into Hissuno as sessions. Runs incrementally on
  a schedule, advances a per-workspace cursor in automation_skill_state, and
  registers external→hissuno id mappings so subsequent runs skip already-synced
  conversations.
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
  plugins: [intercom]
timeoutMs: 1800000
---

# Intercom Conversations Sync

Pulls conversations from Intercom into Hissuno's `sessions` resource.

## What this skill does

1. Loads the cursor (`updatedSince`) from `automation_skill_state`.
2. Searches Intercom conversations updated since the cursor (paginated via `starting_after`).
3. For each conversation: fetches the full conversation (with parts/contacts), maps it to a session payload, and POSTs to `/api/sessions` with `external_id` + `external_source = 'intercom'`.
4. Saves the new cursor (max `updated_at`) back to `automation_skill_state`.

## How to run

```bash
tsx scripts/sync.ts
```

Reads these env vars (the sandbox harness injects them):

- `INTERCOM_ACCESS_TOKEN` — provided by `requires.plugins: [intercom]`
- `HISSUNO_API_KEY`, `HISSUNO_PROJECT_ID`, `HISSUNO_SKILL_ID`
- `HISSUNO_BASE_URL` — defaults to `http://localhost:3000`
