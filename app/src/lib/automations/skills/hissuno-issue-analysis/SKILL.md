---
name: hissuno-issue-analysis
description: >
  Use when an issue needs prioritization analysis. Reads the issue plus
  linked feedback, scores it on reach/impact/confidence/effort, picks an
  effort estimate, and writes a product brief. Triggered manually from the
  issue page; also runnable on a schedule or on issue creation.
version: 1.0
triggers:
  manual: { entity: issue }
  events:
    - issue.created
input:
  issueId:
    type: string
    required: true
    description: ID of the issue to analyze.
capabilities:
  sandbox: true
  webSearch: false
output:
  type: object
  required: [issueId, brief, scores, effortEstimate, reasoning]
  properties:
    issueId:
      type: string
      description: Issue id this run analyzed.
    brief:
      type: string
      description: Markdown product brief, under 400 words.
    scores:
      type: object
      required: [reach, impact, confidence, effort]
      properties:
        reach: { type: integer, description: "1-5" }
        impact: { type: integer, description: "1-5" }
        confidence: { type: integer, description: "1-5" }
        effort: { type: integer, description: "1-5" }
    effortEstimate:
      type: string
      enum: [trivial, small, medium, large, xlarge]
      description: Effort tier matching the effort score.
    reasoning:
      type: object
      required: [reach, impact, confidence, effort]
      properties:
        reach: { type: string }
        impact: { type: string }
        confidence: { type: string }
        effort: { type: string }
---

# Issue Analysis Skill

Analyze a single issue end-to-end: gather context, score it, write a brief, submit results.

The harness already gave you the issue id (in `Trigger.entity.id` and as `issueId` in your input). Read it with `hissuno` CLI commands inside your sandbox.

If the harness shows a `# Codebase` section, the project has a connected codebase. Use `analyze_codebase` to ground your effort estimate (Phase 3) and proposed direction in the brief (Phase 6) in real code. If no codebase is connected, proceed without it — it's optional.

## Phases

### 1. Gather context
Run:
```bash
hissuno get issues "$ISSUE_ID" --json > issue.json
```

`issue.json` has the issue record plus `relationships` (linked sessions, contacts, companies, scope). Parse with `jq`.

If the issue has more than ~30 linked sessions, you don't need to read them all individually — work from aggregate counts and a sample.

Optional, only if you need richer context for impact analysis:
```bash
# Pull product scope so you can align with declared goals
SCOPE_ID=$(jq -r '.relationships.product_scope[0].id // empty' issue.json)
[ -n "$SCOPE_ID" ] && hissuno get scopes "$SCOPE_ID" --json > scope.json
```

### 2. Score impact (1-5)
Use the issue type, description, linked customer signal (ARR, account stage, count of customers affected), and any goal alignment from the scope.

Scoring rubric:
- **5** — multi-customer pain, blocking material workflows, hits champions or strategic accounts
- **4** — significant friction for a notable group of customers, OR strong signal from a high-ARR account
- **3** — meaningful friction but localized; a few customers
- **2** — minor friction OR single account
- **1** — cosmetic or one-off

Write `impact_analysis` as `{ impactScore, reasoning, goalAlignments? }`.

### 3. Estimate effort (1-5)
From the description and your sense of code complexity. Map to effort estimate:
- `trivial` (1) — config tweak / one-line / docs
- `small` (2) — single file, no migrations
- `medium` (3) — handful of files, no schema changes
- `large` (4) — schema or API change, multi-system touch
- `xlarge` (5) — significant architectural work or multi-team

`effort_estimate` is the string. `effort_score` is 1-5 (matching the rank above).

If the project has a connected codebase, call `analyze_codebase` once with a focused question like "which files/modules would change to implement: <one-line problem from the issue>?" Use the returned file count, surface area, and presence/absence of related abstractions to size the tier. Don't ask multiple questions — one well-formed question is usually enough at this phase.

### 4. Estimate confidence (1-5)
How confident are you in the impact and effort scores given the available signal?

- **5** — strong, consistent feedback from multiple customers; clear scope
- **3** — reasonable signal; some ambiguity
- **1** — single user, vague description, ambiguous scope

### 5. Compute reach (1-5) — deterministic
Reach is a function of how many sessions are linked and how recently. Use this exact formula (it mirrors `app/src/lib/issues/reach.ts`):

- Take session timestamps from `issue.json` (`relationships.session[].created_at`).
- 14-day window. Density = sessionsInWindow / 14. Acceleration = recentHalfRate - olderHalfRate.

```
if density >= 1.0  AND acceleration > 0  -> 5
elif density >= 0.5 OR sessionCount >= 5 -> 4
elif density >= 0.25 OR sessionCount in 3..4 -> 3
elif sessionsInWindow >= 2 -> 2
else -> 1
```

Write a one-line `reach_reasoning` summarizing density and trend.

If you have zero session timestamps, `reach_score` = 1, `reach_reasoning` = "No session data".

### 6. Write the brief
A product brief is markdown that an engineer or designer can pick up and start working from. It should include:

- One-paragraph context: who's affected, why it matters
- The user-facing problem in plain language
- Proposed direction (high level, no implementation details)
- Open questions or risks
- Suggested success signal

Keep it under 400 words. Quote real customer language from linked feedback when available.

For "Proposed direction" specifically: if a codebase is connected and you have not already done so, ask `analyze_codebase` for the existing surface area touching this problem (entry points, related modules, naming patterns). Reference the real file paths in the direction so the assignee knows where to start. Keep it high-level — do not paste large code blocks.

### 7. Submit to the issue
Write your analysis to `analysis.json` and submit it via the CLI so the server can update the issue record:

```bash
cat > analysis.json <<EOF
{
  "brief": "...",
  "reach_score": 4,
  "reach_reasoning": "...",
  "impact_score": 4,
  "impact_analysis": {
    "impactScore": 4,
    "reasoning": "...",
    "goalAlignments": []
  },
  "confidence_score": 3,
  "confidence_reasoning": "...",
  "effort_score": 3,
  "effort_estimate": "medium",
  "effort_reasoning": "..."
}
EOF

hissuno update issues "$ISSUE_ID" --analysis-file analysis.json
```

The server computes RICE and updates priority automatically when all four scores are present.

### 8. Final response
End your run with a single assistant message that includes every field in the `output` schema declared at the top of this skill: `issueId`, `brief`, `scores.{reach,impact,confidence,effort}`, `effortEstimate`, and `reasoning.{reach,impact,confidence,effort}`. Do not write `output.json` — the harness coerces your final response into the typed object automatically.

## Progress

Call `report_progress` between phases. Suggested labels: `gather`, `impact`, `effort`, `confidence`, `reach`, `brief`, `submit`. Keep messages short.
