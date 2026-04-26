---
name: hissuno-support-wiki
description: >
  Use to compile a support package's wiki: re-analyze each linked knowledge
  source (fetch, sanitize, embed) and organize the embedded chunks into
  structured FAQ / how-to / feature-docs / troubleshooting markdown.
  Triggered manually from the support agent's package settings.
version: 1.0
triggers:
  manual: { entity: package }
input:
  packageId:
    type: string
    required: true
    description: ID of the support package to compile.
capabilities:
  sandbox: true
  webSearch: false
---

# Support Wiki Compilation

Compile the package's knowledge into structured support content. The heavy
lifting (per-source fetch + embed, then LLM-driven section generation) is
already deterministic and exposed through the `hissuno compile package`
CLI command. Your job is to invoke it and surface progress.

## Phases

### 1. Inspect the package
Confirm the package exists and has linked sources:

```bash
hissuno get packages "$PACKAGE_ID" --json > package.json
```

If the package has zero linked sources, stop and write `output.json` with
`{ "skipped": "no sources" }`. Otherwise continue.

### 2. Compile
Invoke the deterministic compile pipeline. This re-analyzes each enabled
source (fetch -> sanitize -> embed) then organizes the chunks into FAQ /
how-to / feature-docs / troubleshooting markdown using the package's
guidelines:

```bash
hissuno compile package "$PACKAGE_ID" --json > compile.json
```

For large packages this can take several minutes. Report progress before
and after the call so the user knows the run is still alive.

If you want to skip re-analyzing sources (faster, but uses whatever was
embedded last time), pass `--skip-analyze`:

```bash
hissuno compile package "$PACKAGE_ID" --skip-analyze --json > compile.json
```

### 3. Final output
Summarize what changed:

```bash
cat > output.json <<EOF
{
  "packageId": "$PACKAGE_ID",
  "sourcesProcessed": $(jq -r '.sourcesProcessed' compile.json),
  "compiled": $(jq -r '.compiled' compile.json),
  "compilationError": $(jq -c '.compilationError' compile.json),
  "compiledAt": $(jq -c '.compiledAt' compile.json)
}
EOF
```

## Progress

Call `report_progress` before and after `hissuno compile package`. Suggested
labels: `inspect`, `compile`, `done`. Keep messages short - one short
sentence each.
