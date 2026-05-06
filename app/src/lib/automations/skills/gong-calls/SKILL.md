---
name: gong-calls
description: >
  Sync Gong calls (recorded sales calls + transcripts) into Hissuno as
  sessions. Cursor advances by call started date.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
  scheduled: { cron: '30 */12 * * *' }
capabilities:
  sandbox: true
requires:
  plugins: [gong]
timeoutMs: 1800000
---

# Gong Calls Sync

Pulls Gong calls and posts them as `sessions`. Reads access key, secret, and
region base URL from `GONG_CREDENTIALS` (Basic auth).

```bash
tsx scripts/sync.ts
```
