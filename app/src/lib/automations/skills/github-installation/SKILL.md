---
name: github-installation
description: >
  Handle GitHub App installation lifecycle webhooks (installation created,
  deleted, repositories added/removed). Records the change so the integrations
  UI can react. The github plugin's other webhooks (issues, pulls) should
  trigger their own skills as the migration progresses.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  events: [webhook.github]
capabilities:
  sandbox: true
  webSearch: false
requires:
  plugins: [github]
timeoutMs: 300000
---

# GitHub Webhooks

Fires for every GitHub webhook delivered to `/api/webhooks/github` after
the plugin's `resolveConnection` matches the installation to a hissuno
connection.

## Migration status

Currently a placeholder. Issue/PR-driven sync still requires the
`github-feedback` and `github-codebase` skills to be migrated and triggered.
This skill exists so that installation events route somewhere meaningful.

## Inputs

```json
{
  "pluginId": "github",
  "connectionId": "<uuid>",
  "externalAccountId": "<installation-id>",
  "payload": { ...github webhook payload... }
}
```

## What to do

Record a short summary to `output.json` describing the event action and
target. Do not call the GitHub API directly here — installation events
don't need it.

```bash
tsx scripts/sync.ts
```
