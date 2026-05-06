---
name: posthog-behavioral
description: >
  Sync PostHog persons (with identifying email) into Hissuno as contacts.
  Minimal version — engagement scoring and per-event signals can be added
  incrementally.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  manual: {}
  scheduled: { cron: '45 */12 * * *' }
capabilities:
  sandbox: true
requires:
  plugins: [posthog]
timeoutMs: 1800000
---

# PostHog Behavioral Sync

Walks PostHog persons paginated by `created_at`, picks those with an email
property, and posts them as `contacts` so behavioral data has somewhere to
land. Engagement signals (per-event activity, feature usage) are not yet
included — extend the script as analytics hooks come online.

```bash
tsx scripts/sync.ts
```
