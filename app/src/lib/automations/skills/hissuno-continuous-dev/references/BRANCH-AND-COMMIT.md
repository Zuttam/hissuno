# Branch and Commit Conventions

## Branch naming

Pattern: `hissuno/<first-8-chars-of-issue-id>-<slugified-title>`

Rules:
- Slug is lowercase, ASCII only.
- Spaces and non-alphanumerics collapse to a single hyphen.
- Leading/trailing hyphens stripped.
- Slug portion max 40 chars (hard-truncate at the last hyphen boundary if possible).
- Total branch name max 60 chars.

Examples:
- id `a1b2c3d4-...`, title `"Fix login flash on Safari"` → `hissuno/a1b2c3d4-fix-login-flash-on-safari`
- id `ffeedd00-...`, title `"Add Slack-style /remind command (quick)"` → `hissuno/ffeedd00-add-slack-style-remind-command-qui`

See `scripts/slugify-branch.sh` for the canonical implementation.

### Collisions

If the branch already exists **and** the issue status is `in_progress`, the previous iteration was interrupted — switch to that branch and resume.

If the branch exists but the issue is **not** `in_progress`, append `-2`, `-3`, ... to the slug until the name is free.

## Commit messages

One commit per logical step is fine; atomic single-commit PRs are also fine. Either way:
- Imperative present tense: `"Add X"`, `"Fix Y"`, not `"Added"` / `"Fixes"`.
- First line ≤ 72 chars.
- Body (optional) wraps at 72, explains the *why* if non-obvious.

Do not include the issue ID in the commit subject — that belongs in the PR body.

## PR title and body

**Title**: the issue's `name` field, verbatim.

**Body**: a short block the human reviewer can scan.

```
Issue: <hissuno-issue-id>
RICE: reach=<r> impact=<i> confidence=<c> effort=<e> → <score>

## What changed
- <one-line per material change>

## Why
<one paragraph tied to the brief's problem statement>

## Verification
- [x] tests: <command>
- [x] lint: <command>
- [ ] manual: <any manual checks the reviewer should perform>
```

Do not mention internal review checklists or AI tooling in the PR body.

## After the PR opens

The skill's last step calls `scripts/record-pr.sh <issue-id> <pr-url>`, which atomically:
1. Sets issue status to `resolved`.
2. Writes `pr_url` on the issue record.

This gives Hissuno a durable link from each shipped issue to the code that shipped it.
