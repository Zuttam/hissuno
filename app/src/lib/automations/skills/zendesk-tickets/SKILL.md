---
name: zendesk-tickets
description: >
  Sync Zendesk tickets (solved + closed) into Hissuno as sessions. Cursor
  advances by `updated_at` from the Zendesk Search API.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
  scheduled: { cron: '0 */6 * * *' }
capabilities:
  sandbox: true
requires:
  plugins: [zendesk]
timeoutMs: 1800000
---

# Zendesk Tickets Sync

Pulls solved/closed Zendesk tickets and posts them as `sessions`. Reads the
subdomain, admin email, and API token from `ZENDESK_CREDENTIALS`.

```bash
tsx scripts/sync.ts
```
