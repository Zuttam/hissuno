---
name: notion-knowledge
description: >
  Walk a Notion page tree (root + descendants) and ingest each page as a
  knowledge source under a chosen product scope. Parameterized: pass
  `rootPageId` and `productScopeId` as run input.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
  scheduled: { cron: '0 4 * * *' }
capabilities:
  sandbox: true
requires:
  plugins: [notion]
input:
  rootPageId:
    type: string
    required: true
    description: Notion page id to start the walk from.
  productScopeId:
    type: string
    required: true
    description: Hissuno product scope to file pages under.
  includeChildren:
    type: boolean
    required: false
    description: Recurse into child pages (default true).
timeoutMs: 1800000
---

# Notion Knowledge Sync

Walks a Notion page tree and posts each page as a knowledge source. The
walker discovers child pages via block children. Pages already synced are
skipped via the external_records mapping (no need to re-ingest unchanged
content yet — extend with last_edited_time filtering when content updates
become a priority).

```bash
tsx scripts/sync.ts
```
