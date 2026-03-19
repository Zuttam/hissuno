# Hissuno Setup Skill

Claude Code skill that automates launching new Hissuno cloud environments. Users ask Claude to "deploy Hissuno" or "set up a new environment" and it provisions Neon database + Vercel hosting + schema + seed + CLI profile end-to-end.

**After**: A single skill invocation provisions a full cloud Hissuno environment, or connects to an existing one.

---

## Current State

- Production deployment is a manual process documented in `app/content/docs/getting-started/production-deployment.md`
- The `hissuno setup` CLI wizard handles local dev setup (10 steps), and partially supports prod via `--only env,database,seed --env prod`
- Neon MCP tools are available (`mcp__Neon__create_project`, `mcp__Neon__run_sql`, `mcp__Neon__get_connection_string`, etc.)
- No Vercel MCP tools or CLI pre-installed
- The `neon-postgres` skill is installed at `~/.claude/skills/neon-postgres/`

### Key Gaps
- No automated cloud provisioning workflow
- No skill to guide Claude through Neon + Vercel setup
- CLI `skills install` only installs the main `hissuno` skill (not setup skill)
- Main hissuno skill has no cross-reference to setup/provisioning

---

## Phase 1: Create Skill (SKILL.md + References)

**New directory:** `app/packages/skills/hissuno-setup/`

### SKILL.md (~350 lines)

Frontmatter with pushy description triggering on: deploy, provision, host, launch, setup, environment, infra, self-host, production, staging.

**Sections:**
1. **Overview** - What this skill does
2. **Prerequisites** - Neon MCP tools, Vercel CLI, Hissuno CLI, GitHub account, OpenAI key, local repo clone
3. **Decision Tree** - Ask user: new env vs existing? What infra already exists?
4. **Flow A: New Cloud Environment** - 5-step pipeline:
   - Step 1: Create Neon Database (-> `references/NEON-SETUP.md`)
   - Step 2: Deploy to Vercel (-> `references/VERCEL-DEPLOY.md`)
   - Step 3: Push Schema & Seed (-> `references/SCHEMA-AND-SEED.md`)
   - Step 4: Configure CLI Profile (-> `references/CLI-PROFILE.md`)
   - Step 5: Verify & Report
5. **Flow B: Partial Setup** - Checklist to skip already-completed steps
6. **Flow C: Connect to Existing** - Just create a CLI profile
7. **Environment Variables Reference** - Table of required/optional vars
8. **Troubleshooting** - pgvector, root directory, connection strings

**Key variables flowing through the pipeline:**
- `DATABASE_URL` (from Neon)
- `NEXT_PUBLIC_APP_URL` (from Vercel)
- `AUTH_SECRET` (generated)
- `OPENAI_API_KEY` (from user)
- `API_KEY` (from seed output)

### Reference Files (4)

| File | Lines | Content |
|------|-------|---------|
| `references/NEON-SETUP.md` | ~120 | Create project via MCP, enable pgvector, get connection string, handle existing projects |
| `references/VERCEL-DEPLOY.md` | ~150 | Vercel CLI only: install if missing, link, env vars, deploy, blob storage, custom domain |
| `references/SCHEMA-AND-SEED.md` | ~100 | `hissuno setup --only env,database,seed`, capture seed output, verify via Neon MCP |
| `references/CLI-PROFILE.md` | ~60 | `hissuno profile create`, switching, naming conventions, verification |

---

## Phase 2: Update Main Hissuno Skill

**File:** `app/packages/skills/hissuno/SKILL.md`

Add cross-reference after "Configuration & Profiles" section (line 62):

```markdown
### Provisioning New Environments

To deploy a new Hissuno instance (create database, deploy to cloud, push schema, seed data),
see the `hissuno-setup` skill. It handles Neon database creation, Vercel deployment, and
end-to-end environment provisioning.
```

The `hissuno setup` CLI command docs stay in CLI-REFERENCE.md (documents syntax, not the provisioning workflow).

---

## Phase 3: Update CLI Skills Install

**Files:** `app/packages/cli/src/commands/skills.ts`, `app/packages/cli/package.json`

### package.json prebuild
Copy both skill directories into bundled `skills/`:
```
skills/hissuno/SKILL.md + references/
skills/hissuno-setup/SKILL.md + references/
```

### skills.ts
- `getBundledSkillsPath()` returns parent `skills/` dir (contains subdirs with SKILL.md)
- Add `--skill <name>` option to install a specific skill (default: install all)
- Install iterates over subdirectories, copying each to `~/.claude/skills/<name>/`
- Status shows each skill separately
- Uninstall supports `--skill <name>` or removes all hissuno skills
- Constants: `CLAUDE_SKILLS_DIR = ~/.claude/skills`, `CURSOR_SKILLS_DIR = ~/.cursor/skills`

---

## New Files (6)

| File | Phase |
|------|-------|
| `app/packages/skills/hissuno-setup/SKILL.md` | 1 |
| `app/packages/skills/hissuno-setup/references/NEON-SETUP.md` | 1 |
| `app/packages/skills/hissuno-setup/references/VERCEL-DEPLOY.md` | 1 |
| `app/packages/skills/hissuno-setup/references/SCHEMA-AND-SEED.md` | 1 |
| `app/packages/skills/hissuno-setup/references/CLI-PROFILE.md` | 1 |

## Modified Files (3)

| File | Phase | Change |
|------|-------|--------|
| `app/packages/skills/hissuno/SKILL.md` | 2 | Add cross-reference to setup skill |
| `app/packages/cli/src/commands/skills.ts` | 3 | Multi-skill install support |
| `app/packages/cli/package.json` | 3 | Update prebuild to copy both skills |

## Reuses

| What | Where |
|------|-------|
| Setup CLI flow | `app/packages/cli/src/commands/setup.ts` + `setup/*.ts` |
| Config/profile management | `app/packages/cli/src/lib/config.ts` |
| Production deployment docs | `app/content/docs/getting-started/production-deployment.md` |
| Neon MCP tools | Available via `mcp__Neon__*` |
| Neon skill reference | `~/.claude/skills/neon-postgres/SKILL.md` |
| Env var reference | `app/env.example` |
