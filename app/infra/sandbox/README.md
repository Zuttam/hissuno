# Skill-runner sandbox image

The image the automation runner uses to execute skill bodies in production.
Local dev defaults to `LocalSandbox` (no image needed), so this is only
relevant when you flip `SANDBOX_PROVIDER=e2b` (or another cloud provider
in the future).

## What it ships with

- `hissuno` CLI on PATH (skills shell out to it for all data access)
- `git` + `gh` (continuous-dev clones + opens PRs)
- `jq` (parsing `--json` CLI output in skill bodies)
- `node:22-slim` base for general scripting

## Env vars the sandbox sees

The runner injects these per run; the image doesn't have to know about them
ahead of time.

| Var | Notes |
| --- | --- |
| `HISSUNO_API_KEY` | Project-scoped, long-lived. Pre-authenticates the CLI. |
| `HISSUNO_PROJECT_ID` | Current project. |
| `HISSUNO_RUN_ID` | This run's id (for logging / output JSON). |
| `HISSUNO_SKILL_ID` | The skill being executed. |
| `ENTITY_TYPE` / `ENTITY_ID` | Triggering entity (when present). |
| `ISSUE_ID` / `CUSTOMER_ID` / `SCOPE_ID` / `PACKAGE_ID` | Type-specific aliases for convenience. |
| `HISSUNO_RUN_INPUT` | JSON-encoded structured input from the trigger. |

The host's `process.env` is deliberately not forwarded - global secrets
stay on the runner side.

## Build + register (E2B path)

```bash
# Install E2B CLI
npm install -g @e2b/cli

# Place a built copy of the hissuno CLI at infra/sandbox/hissuno-cli/
# (the Dockerfile COPYs it into the image)
npm --workspace packages/cli run build
cp -r packages/cli/dist infra/sandbox/hissuno-cli

# Build + publish the template
cd infra/sandbox
e2b template init       # first time only
e2b template build      # returns a template id
```

Then in the runner's env:

```
SANDBOX_PROVIDER=e2b
E2B_API_KEY=<from e2b dashboard>
E2B_SANDBOX_TEMPLATE=<id from `e2b template build`>
```

## Other providers

`createSandbox()` in `src/mastra/workspace/build.ts` is a switch on
`SANDBOX_PROVIDER`. To add Daytona, Modal, or Blaxel, mirror the e2b case
- import the provider package, validate the required env vars, return the
new instance. Image expectations stay the same.
