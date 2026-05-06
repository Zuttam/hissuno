---
name: hissuno-continuous-dev
description: >
  Use when picking the next development issue to work on and implementing it end-to-end.
  This skill is the body of a continuous development loop - it selects the highest-priority
  ready issue from Hissuno, implements it, and creates a PR.
  Triggers on: next issue, continuous development, dev loop, what to build next,
  pick next task, implement next issue, development queue.
  Requires the hissuno CLI to be configured.
license: MIT
metadata:
  author: hissuno
  version: "1.1"
---

# Continuous Development

Picks the next highest-priority issue from Hissuno, implements it, opens a PR, and records the PR URL back on the issue. Designed to be invoked repeatedly (e.g., via a loop) for continuous autonomous development.

Selection is simple: highest RICE score among issues with status `ready` wins. See `references/RICE-SELECTION.md`.

## Prerequisites

- `hissuno` CLI configured and connected (`hissuno config show` to verify)
- `gh` CLI installed and authenticated (`gh auth status`) - required for PR creation
- `jq` available on PATH - scripts parse Hissuno JSON output
- Working directory is a git repository
- Clean working tree (no uncommitted changes) - verify with `git status`
- On the main branch (or a known base branch)

If any prerequisite fails, stop and report the issue. See `references/EDGE-CASES.md` for recovery guidance.

## Workflow

### Phase 1: Select Issue

**Step 1 - Check for in-progress work.**
Look for any issue already claimed by a previous iteration:

```bash
hissuno list issues --status in_progress --json
```

If an in-progress issue is found, resume it - skip to Phase 2 Step 2 (switch to its branch).

**Step 2 - List ready issues.**
If no in-progress issue exists, fetch the queue:

```bash
hissuno list issues --status ready --json --limit 50
```

If the list is empty, report "No issues with status 'ready' found. Queue is empty." and stop.

**Step 3 - Pick by RICE score.**
Use the helper script (see `references/RICE-SELECTION.md` for the formula and edge cases):

```bash
scripts/pick-top-ready-issue.sh
```

It prints a single JSON object: `{"id": "...", "rice_score": ..., "name": "...", "type": "..."}` or exits 1 with a message on stderr if the queue is empty.

**Step 4 - Load full context.**
Get the complete issue with its brief, relationships, and linked scope:

```bash
hissuno get issues <id>
```

The **brief** is the implementation spec. See `references/BRIEF-INTERPRETATION.md` for how to read it.

**Step 5 - Display selection.**
Show the user:
- Issue title and type (bug / feature_request / change_request)
- RICE breakdown: reach, impact, confidence, effort, computed score
- Brief summary (first few lines)
- Related scope (if any)

### Phase 2: Setup

**Step 1 - Create branch.**
Generate the branch name using the helper (see `references/BRANCH-AND-COMMIT.md` for the naming rule):

```bash
BRANCH=$(scripts/slugify-branch.sh <id> "<title>")
git checkout -b "$BRANCH"
```

If the branch already exists (resuming in-progress): `git checkout "$BRANCH"` instead.

**Step 2 - Mark in progress.**

```bash
hissuno update issues <id> --status in_progress
```

### Phase 3: Implement

**Step 1 - Read the brief.**
The brief from `hissuno get issues <id>` is the implementation spec. See `references/BRIEF-INTERPRETATION.md` for how to extract files, acceptance criteria, and scope boundaries.

**Step 2 - Plan the implementation.**
Based on the brief:
- Identify the files that need to change
- Break the work into discrete steps
- Note any test files that need updating

**Step 3 - Implement with tests.**
For each step:
1. Write or update tests first
2. Implement the change
3. Verify the test passes

After all steps, run the full test suite and linter to confirm nothing is broken.

**Step 4 - Scope check.**
Review the diff. Every changed file should trace back to something in the brief. If changes extend beyond what the brief specified, revert the extra changes. The goal is to stay tightly scoped to the issue.

### Phase 4: Finish

**Step 1 - Verify.**
Run the full test suite and linter one final time. All must pass before proceeding.

**Step 2 - Commit and push.**
Commit convention and PR body format: see `references/BRANCH-AND-COMMIT.md`.

```bash
git push -u origin "$BRANCH"
```

**Step 3 - Open the PR.**

```bash
PR_URL=$(gh pr create --title "<issue title>" --body "<body including hissuno issue id + RICE>" --json url --jq .url)
```

If `gh pr create` fails, see `references/EDGE-CASES.md`.

**Step 4 - Record PR + mark resolved.**

```bash
scripts/record-pr.sh <id> "$PR_URL"
```

This atomically sets `status=resolved` and `pr_url=<PR_URL>` on the issue via a single `hissuno update issues` call.

**Step 5 - Report.**
Output a summary:
- Issue title and ID
- Branch name
- PR URL (now also stored on the issue record)
- Number of files changed
- Tests added or modified

## Edge Cases

See `references/EDGE-CASES.md` for handling:
- `gh` not authenticated
- `git push` rejected (e.g., branch protection)
- `gh pr create` failed
- Tests fail after implementation (retry budget + stop rules)
- Brief is unclear or incomplete
- Branch name collision
- Mid-implementation interruption (resume path)
