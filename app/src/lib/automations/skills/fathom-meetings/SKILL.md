---
name: fathom-meetings
description: >
  Sync Fathom meetings (recorded calls + transcripts) into Hissuno as
  sessions. Cursor advances by `created_at`.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
  scheduled: { cron: '15 */6 * * *' }
capabilities:
  sandbox: true
requires:
  plugins: [fathom]
timeoutMs: 1800000
---

# Fathom Meetings Sync

Pulls Fathom meetings and posts them as `sessions` with the transcript as
messages.

```bash
tsx scripts/sync.ts
```
