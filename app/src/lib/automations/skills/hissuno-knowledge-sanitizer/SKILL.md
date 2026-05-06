---
name: hissuno-knowledge-sanitizer
description: >
  Use when a knowledge source is created to redact sensitive information
  (API keys, tokens, credentials, internal IPs, PII) and re-embed the
  source. Triggered automatically on knowledge.created.
version: 1.0
triggers:
  events:
    - knowledge.created
input:
  sourceId:
    type: string
    required: true
    description: ID of the knowledge source to sanitize.
capabilities:
  sandbox: true
  webSearch: false
output:
  type: object
  required: [sourceId, redactions, changed]
  properties:
    sourceId:
      type: string
      description: Knowledge source id this run sanitized.
    redactions:
      type: integer
      description: Number of sensitive items redacted.
    changed:
      type: boolean
      description: Whether any content was changed.
    chunksEmbedded:
      type: integer
      description: Number of chunks re-embedded (only when changed).
---

# Knowledge Sanitizer Skill

Redact sensitive information from a freshly created knowledge source and re-embed.

The harness gave you the source id (in `Trigger.entity.id` and as `sourceId` in your input) and the scope id (in `Trigger.entity.snapshot.productScopeId`).

## How it works

The sanitization is implemented server-side. Your job is to invoke it and report the result.

```bash
hissuno sanitize knowledge "$SOURCE_ID" --scope "$SCOPE_ID" --json > result.json
```

The endpoint:
1. Loads the source's analyzed content
2. Runs an LLM scan that redacts secrets (AWS keys, API keys, GitHub tokens, database URLs, passwords, private keys, internal IPs, etc.) with placeholders like `[REDACTED_AWS_KEY]`
3. If anything changed, persists the sanitized content and re-embeds the source
4. Returns `{ sourceId, redactions, changed, chunksEmbedded? }`

If `analyzed_content` is empty (source still being analyzed or fetch failed), the response includes `skipped: "no_content"` and you should report `redactions: 0, changed: false`.

## Final response

End your run with a single assistant message that includes every field in the `output` schema declared at the top of this skill: `sourceId`, `redactions`, `changed`, and `chunksEmbedded` if present. Do not write `output.json` — the harness coerces your final response into the typed object automatically.

## Progress

Call `report_progress` with a single label like `sanitize`. Keep messages short.
