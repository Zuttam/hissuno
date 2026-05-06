---
name: jira-issues
description: >
  Sync issues from a Jira Cloud project into Hissuno. Parameterized per
  project — pass `projectKey` (and optionally `cloudId` if the connection has
  multiple sites) as run input. Cursor advances by Jira `updated` timestamp.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
  scheduled: { cron: '30 */6 * * *' }
capabilities:
  sandbox: true
requires:
  plugins: [jira]
input:
  projectKey:
    type: string
    required: true
    description: Jira project key (e.g. ENG, PROD).
  cloudId:
    type: string
    required: false
    description: Override which Jira site to query (rarely needed).
timeoutMs: 1800000
---

# Jira Issues Sync

Pulls issues from one Jira project. The OAuth access token is provided by
the credential resolver, refreshed if needed before this skill runs.

```bash
tsx scripts/sync.ts
```
