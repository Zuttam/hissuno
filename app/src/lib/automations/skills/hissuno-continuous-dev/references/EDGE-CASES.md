# Edge Cases

Failure modes and recovery for the continuous-dev loop.

## Prerequisite failures

| Symptom | Recovery |
|---|---|
| `hissuno config show` errors | Run `hissuno config` to set API key + URL + project. Stop this iteration. |
| `gh auth status` errors | Ask the user to run `gh auth login`. Stop this iteration. |
| Working tree dirty | Ask the user to commit, stash, or discard. Do not auto-stash. |
| Not on main/base branch | Ask the user where the base branch is (`main`? `master`? `trunk`?). Stop until confirmed. |

## Empty queue

`hissuno list issues --status ready --json` returns `[]`.

Report: "No issues with status 'ready' found. Queue is empty." Stop. This is normal — it means the backlog needs triaging, not that something is broken.

## Brief missing or unclear

See `references/BRIEF-INTERPRETATION.md`. Do not implement beyond what the brief describes. When in doubt, stop and ask; leave the issue in `ready`.

## Tests fail after implementation

Budget: **up to 3 fix attempts** per failing test suite.

Each attempt:
1. Read the failure output carefully.
2. Make the smallest possible fix.
3. Re-run the failing test only, then the full suite.

After 3 failed attempts:
- Leave the issue as `in_progress`.
- Report the failure with final test output.
- Stop. The next invocation resumes on the same branch — either the agent gets unstuck or a human intervenes.

Do **not**:
- Disable, skip, or delete failing tests.
- Mark the issue `resolved` with known-failing tests.

## Branch name collision

If the branch exists and the issue is `in_progress`: resume on that branch.

If the branch exists and the issue is **not** `in_progress`: something is off (stale branch, or manual work). Append `-2`, `-3`, ... to the slug. If a human might be working on that branch, ask before proceeding.

## `git push` rejected

Common causes and responses:
- **Branch protection** on the remote. Ask the user to relax the rule for `hissuno/*` or to push manually.
- **Non-fast-forward**. Almost always means someone else pushed to this branch. Stop and ask.
- **Remote doesn't exist** (first push). Use `git push -u origin "$BRANCH"` — the skill's standard command handles this.

Do not force-push. Ever.

## `gh pr create` failed

- **No remote tracking branch**: already handled by `git push -u`.
- **No upstream PR template or missing labels**: retry without the optional flag that failed.
- **Permission denied / repo not accessible**: report and stop.

On failure, record a dev-run note by updating the issue with a short status line in `description` (read, append, PATCH) so the next iteration / the human understands where it stopped. Leave status as `in_progress`.

## Mid-implementation interruption (resume path)

Pattern: Claude Code dies, user stops the session, machine reboots.

Next invocation of the skill:
1. Phase 1 Step 1 finds the still-`in_progress` issue.
2. Phase 2 Step 1 sees the branch already exists and switches to it instead of creating.
3. Phase 3 picks up the diff mid-flight.

Invariant: the skill never creates duplicate work for the same issue because `in_progress` is checked first.

## Issue was cancelled mid-flight

If an external actor (human) flips the issue to `closed` while the skill is running:
- On next CLI call, the skill notices status is no longer `in_progress`.
- Stop. Leave the branch intact. Report that the issue was cancelled.
- Do **not** auto-revert the branch or auto-close any opened PR.
