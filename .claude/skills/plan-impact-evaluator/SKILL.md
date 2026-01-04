---
name: plan-impact-evaluator
description: This skill should be used when the user asks to "create a plan", "write a plan", "implement a feature", "make changes", or when exiting plan mode. Evaluates plan impact and manages plan lifecycle - high impact plans are saved to `.claude/plans/pending/`, and moved to `.claude/plans/done/` when implementation completes.
---

# Plan Impact Evaluator

Evaluate the impact of plans before implementation and manage plan files through their lifecycle. High-impact plans are persisted for tracking and review.

## When to Apply

**Evaluate impact when:**
- Creating or finalizing a new plan
- Exiting plan mode with ExitPlanMode
- User explicitly asks for plan impact assessment

**Move to done when:**
- Implementation is complete
- User confirms work is finished
- All phases/tasks in the plan are done

## Impact Classification

### High Impact (Save to `pending/`)

A plan is HIGH IMPACT if it meets ANY of these criteria:

| Category | Criteria |
|----------|----------|
| **Scope** | Touches 5+ files, or adds new API endpoints, or creates new database tables |
| **Architecture** | New patterns, services, integrations, or significant refactors |
| **Risk** | Breaking changes, auth/security changes, data migrations |
| **Duration** | Multi-phase implementation requiring multiple sessions |
| **Dependencies** | External service integrations, new packages, infrastructure changes |

### Low Impact (Skip saving)

- Bug fixes with obvious solutions
- Single-file changes
- Documentation updates
- Config tweaks
- Styling adjustments

## Workflow

### Step 1: Evaluate Impact

When a plan is created or finalized, assess against the high-impact criteria above.

**Output format:**
```
## Impact Assessment

**Classification:** HIGH IMPACT / LOW IMPACT

**Reasoning:**
- [List which criteria were met or not met]

**Files affected:** [count]
**Phases:** [count]
```

### Step 2: Handle High-Impact Plans

For HIGH IMPACT plans:

1. Generate filename: `YYYY-MM-DD-[slug].md` (e.g., `2026-01-09-user-authentication.md`)
2. Save to `.claude/plans/pending/`
3. Include frontmatter:

```markdown
---
status: pending
created: YYYY-MM-DD
impact: high
summary: [One-line summary]
---

# Plan: [Title]

[Full plan content...]
```

### Step 3: Mark Implementation Complete

When implementation finishes:

1. Run: `./scripts/complete-plan.sh [plan-filename]`
2. Or manually move file from `pending/` to `done/`
3. Update frontmatter status to `completed`

## Directory Structure

```
.claude/plans/
├── pending/          # Active plans awaiting implementation
│   └── 2026-01-09-feature-x.md
├── done/             # Completed implementations
│   └── 2026-01-08-feature-y.md
└── [legacy files]    # Existing plans (not managed by this skill)
```

## Scripts

### Complete a plan

```bash
.claude/skills/plan-impact-evaluator/scripts/complete-plan.sh [filename]
```

Moves plan from `pending/` to `done/` and updates status.

## Quick Reference

| Scenario | Action |
|----------|--------|
| New high-impact plan | Save to `pending/` with frontmatter |
| Low-impact plan | Skip saving, proceed normally |
| Implementation done | Move to `done/`, update status |
| Check pending plans | `ls .claude/plans/pending/` |
| Review completed work | `ls .claude/plans/done/` |
