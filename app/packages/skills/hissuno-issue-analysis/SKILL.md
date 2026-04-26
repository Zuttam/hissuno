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
---

# Issue Analysis Skill

Analyze a single issue end-to-end: gather context, score it, write a brief, submit results.

The harness already gave you the issue id (in `Trigger.entity.id` and as `issueId` in your input). Read it with `hissuno` CLI commands inside your sandbox.

## Phases

### 1. Gather context
Run:
```bash
hissuno get issues "$ISSUE_ID" --json > issue.json
```

`issue.json` has the issue record plus `relationships` (linked sessions, contacts, companies, scope). Parse with `jq`.

If the issue has more than ~30 linked sessions, you don't need to read them all individually - work from aggregate counts and a sample.

Optional, only if you need richer context for impact analysis:
```bash
# Pull product scope so you can align with declared goals
SCOPE_ID=$(jq -r '.relationships.product_scope[0].id // empty' issue.json)
[ -n "$SCOPE_ID" ] && hissuno get scopes "$SCOPE_ID" --json > scope.json
```

### 2. Score impact (1-5)
Use the issue type, description, linked customer signal (ARR, account stage, count of customers affected), and any goal alignment from the scope.

Scoring rubric:
- **5** - multi-customer pain, blocking material workflows, hits champions or strategic accounts
- **4** - significant friction for a notable group of customers, OR strong signal from a high-ARR account
- **3** - meaningful friction but localized; a few customers
- **2** - minor friction OR single account
- **1** - cosmetic or one-off

Write `impact_analysis` as `{ impactScore, reasoning, goalAlignments? }`.

### 3. Estimate effort (1-5)
From the description and your sense of code complexity. Map to effort estimate:
- `trivial` (1) - config tweak / one-line / docs
- `small` (2) - single file, no migrations
- `medium` (3) - handful of files, no schema changes
- `large` (4) - schema or API change, multi-system touch
- `xlarge` (5) - significant architectural work or multi-team

`effort_estimate` is the string. `effort_score` is 1-5 (matching the rank above).

### 4. Estimate confidence (1-5)
How confident are you in the impact and effort scores given the available signal?

- **5** - strong, consistent feedback from multiple customers; clear scope
- **3** - reasonable signal; some ambiguity
- **1** - single user, vague description, ambiguous scope

### 5. Compute reach (1-5) - deterministic
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

### 7. Submit results
Write your analysis to `analysis.json` and submit:

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

### 8. Final output
Write `output.json` summarizing what changed:

```bash
cat > output.json <<EOF
{
  "issueId": "$ISSUE_ID",
  "scores": { "reach": 4, "impact": 4, "confidence": 3, "effort": 3 },
  "briefBytes": $(wc -c < brief.md 2>/dev/null || echo 0)
}
EOF
```

## Progress

Call `report_progress` between phases. Suggested labels: `gather`, `impact`, `effort`, `confidence`, `reach`, `brief`, `submit`. Keep messages short.
