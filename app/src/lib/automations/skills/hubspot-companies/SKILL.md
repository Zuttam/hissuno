---
name: hubspot-companies
description: >
  Sync HubSpot companies into Hissuno. Runs incrementally; cursor advances by
  hs_lastmodifieddate. OAuth refresh is handled by the credential resolver
  before this skill runs, so the access token in env is always fresh.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
  scheduled: { cron: '0 */12 * * *' }
capabilities:
  sandbox: true
requires:
  plugins: [hubspot]
timeoutMs: 1800000
---

# HubSpot Companies Sync

Pulls HubSpot companies into Hissuno's `companies` resource.

## What this skill does

1. Loads cursor (`lastModifiedSince`) from `automation_skill_state`.
2. Searches CRM companies via HubSpot's search API filtered by `hs_lastmodifieddate >= cursor`.
3. POSTs each as `/api/companies` with `external_id` (HubSpot id) + `external_source = 'hubspot'`. Batches via `{ items: [...] }`.
4. Saves max `hs_lastmodifieddate` back as the new cursor.

```bash
tsx scripts/sync.ts
```
