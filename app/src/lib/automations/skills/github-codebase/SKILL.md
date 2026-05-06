---
name: github-codebase
description: >
  Register a GitHub repository as a Hissuno codebase. Parameterized: pass
  `repoFullName` and optional `branch`. Verifies the repo (and branch, if
  provided) is reachable, then POSTs to /api/codebases. Re-running is
  idempotent — duplicate codebases on the same (project, repo, branch) are
  filtered server-side.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
capabilities:
  sandbox: true
requires:
  plugins: [github]
input:
  repoFullName:
    type: string
    required: true
    description: owner/repo to register.
  branch:
    type: string
    required: false
    description: Defaults to main.
timeoutMs: 300000
---

# GitHub Codebase Registration

Verifies the repo is reachable with the connection's token and registers
the codebase. Subsequent code analysis runs against the registered codebase
via the existing codebase pipeline.

```bash
tsx scripts/sync.ts
```
