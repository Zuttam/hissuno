---
name: slack-events
description: >
  Handle real-time Slack events (threads, mentions, messages) for connected
  Slack workspaces. Fires whenever a Slack webhook lands. The full event
  payload is available as HISSUNO_RUN_INPUT.payload; the connection metadata
  is in HISSUNO_RUN_INPUT.connectionId / externalAccountId.
version: "1.0"
license: MIT
metadata:
  author: hissuno
triggers:
  events: [webhook.slack]
capabilities:
  sandbox: true
  webSearch: false
requires:
  plugins: [slack]
timeoutMs: 600000
---

# Slack Events

This skill fires for every Slack webhook delivered to `/api/webhooks/slack`.
The webhook receiver verifies the request signature and resolves the
hissuno connection before triggering this skill.

## Migration status

The current production behavior (thread capture as sessions, bot mentions,
auto-replies) lives in `app/src/lib/integrations/slack/event-handlers.ts`
and is invoked in-process by the webhook route alongside this event. That
handler is rich (message processor, response classifier, etc.) and has not
yet been ported to a sandboxed script. This skill is a placeholder that
records the inbound payload — extend it as the legacy handler is migrated.

## Inputs

```json
{
  "pluginId": "slack",
  "connectionId": "<uuid>",
  "externalAccountId": "T0XXXXX",
  "payload": { ...slack event_callback... }
}
```

## What to do

For now: write a short summary to `output.json` describing the event type
(`message`, `app_mention`, etc.), team id, and any thread context. The agent
should not attempt to call the Slack API directly until the handler is
migrated — the in-process handler will already have processed the event.

```bash
tsx scripts/sync.ts
```
