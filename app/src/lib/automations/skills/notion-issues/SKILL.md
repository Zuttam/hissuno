---
name: notion-issues
description: >
  Sync rows from a Notion database into Hissuno as issues. Parameterized:
  pass `databaseId` as run input. Field mapping is conservative (title from
  the first title property; status/priority/type defaulted). Extend the
  script with `fieldMapping` once a richer config surface exists.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
  scheduled: { cron: '0 5 * * *' }
capabilities:
  sandbox: true
requires:
  plugins: [notion]
input:
  databaseId:
    type: string
    required: true
    description: Notion database id whose rows become issues.
timeoutMs: 1800000
---

# Notion Issues Sync

Reads database rows and posts each as an issue. Cursor advances by Notion's
`last_edited_time`.

```bash
tsx scripts/sync.ts
```
