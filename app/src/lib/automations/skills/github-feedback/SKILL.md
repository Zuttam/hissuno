---
name: github-feedback
description: >
  Sync GitHub issues from a repository as feedback sessions. Parameterized:
  pass `repoFullName` (owner/repo) as run input. Cursor advances by issue
  `updated_at`. Pulls comments inline so each session has the full thread.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
  scheduled: { cron: '0 */4 * * *' }
capabilities:
  sandbox: true
requires:
  plugins: [github]
input:
  repoFullName:
    type: string
    required: true
    description: owner/repo to sync.
timeoutMs: 1800000
---

# GitHub Feedback Sync

Pulls GitHub issues from one repo and posts each as a `session` (with the
issue body as the opening message and comments as follow-ups). The
credential resolver injects `GITHUB_ACCESS_TOKEN` for PAT auth, or the
script generates an installation token from `GITHUB_CREDENTIALS` for App
auth (currently script supports PAT path; App-token issuance can be added
when needed).

```bash
tsx scripts/sync.ts
```
