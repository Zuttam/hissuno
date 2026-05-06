# RICE Selection

The skill picks the single highest-RICE issue whose `status` is `ready`.

## Formula

```
RICE = (reach_score * impact_score * confidence_score) / effort_score
```

All four scores live directly on the issue record (`reach_score`, `impact_score`, `confidence_score`, `effort_score`).

## Missing scores

If any score is `null`, treat the issue as de-prioritized (RICE = 0). This pushes under-analyzed issues below fully-scored ones.

An issue with all four scores missing but status `ready` is unusual - surface it to the user before picking, since the brief likely needs review.

## Tie-breakers

If two issues tie on RICE:
1. Higher `priority` wins (`high` > `medium` > `low`).
2. Older `created_at` wins (stale issues clear first).

## Script contract

`scripts/pick-top-ready-issue.sh`:
- Calls `hissuno list issues --status ready --json --limit 50`.
- Computes RICE per the formula above (null scores → 0, null effort → 1 to avoid div-by-zero, still pushes to 0 via null reach/impact/confidence).
- Prints one JSON line to stdout with `{id, rice_score, name, type, priority}`.
- Exits 0 on success, 1 with a message on stderr if the queue is empty or CLI errors.

Callers parse the JSON with `jq` or equivalent. Do not prose-match the output.

## Why not a composite API endpoint?

Keeping selection client-side means:
- Different teams can swap in their own scoring (e.g. ICE, WSJF) by editing the script.
- No Hissuno release needed to change the ranking rule.
- The formula stays visible and auditable in the repo that ships it.
