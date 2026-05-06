#!/usr/bin/env bash
# pick-top-ready-issue.sh
#
# Pick the single highest-RICE issue whose status is "ready".
#
# Output (stdout): one JSON line
#   {"id":"...","rice_score":N,"name":"...","type":"...","priority":"..."}
# Exits 1 with an error on stderr if:
#   - hissuno CLI errors
#   - queue is empty
#
# RICE = (reach * impact * confidence) / effort
# Null scores -> 0 RICE (de-prioritize under-analyzed issues).
# Null effort -> treat as 1 to avoid div-by-zero; still pushes to 0 via null
# reach/impact/confidence.
# Tie-break: higher priority (high > medium > low), then older created_at.

set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "pick-top-ready-issue.sh: jq is required but not found on PATH" >&2
  exit 1
fi

json=$(hissuno list issues --status ready --json --limit 50 2>&1) || {
  echo "hissuno list failed: $json" >&2
  exit 1
}

# The `list` command wraps results under different keys in different versions;
# be defensive and flatten anything that looks like an array of issue rows.
count=$(printf '%s' "$json" | jq '
  if type == "array" then length
  elif .issues then (.issues | length)
  elif .data then (.data | length)
  else 0 end
')

if [ "$count" = "0" ]; then
  echo "Queue is empty: no issues with status=ready." >&2
  exit 1
fi

printf '%s' "$json" | jq -c '
  (if type == "array" then .
   elif .issues then .issues
   elif .data then .data
   else [] end)
  | map({
      id,
      name,
      type,
      priority,
      created_at,
      reach: (.reach_score // 0),
      impact: (.impact_score // 0),
      confidence: (.confidence_score // 0),
      effort: ((.effort_score // 0) | if . == 0 then 1 else . end),
    })
  | map(. + { rice_score: ((.reach * .impact * .confidence) / .effort) })
  | sort_by([
      -.rice_score,
      -(if .priority == "high" then 3 elif .priority == "medium" then 2 else 1 end),
      .created_at
    ])
  | .[0]
  | { id, rice_score, name, type, priority }
'
