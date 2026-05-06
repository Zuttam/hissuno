---
name: hubspot-contacts
description: >
  Sync HubSpot contacts into Hissuno with company association. Runs
  incrementally; cursor advances by lastmodifieddate.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
  scheduled: { cron: '15 */12 * * *' }
capabilities:
  sandbox: true
requires:
  plugins: [hubspot]
timeoutMs: 1800000
---

# HubSpot Contacts Sync

Pulls HubSpot contacts into Hissuno's `contacts` resource.

```bash
tsx scripts/sync.ts
```
