# Design: `create-hissuno` CLI bootstrapper

## Overview

A `npx create-hissuno my-app` command that bootstraps a self-hosted Hissuno instance. Clones the repo, detects/installs PostgreSQL (with pgvector), generates `.env.local`, runs migrations, and optionally seeds demo data.

Lives at `app/packages/create-hissuno/`, published as `create-hissuno` on npm.

## User Flow

```
$ npx create-hissuno my-app

  Checking Node.js version... v20.11.0

  Creating Hissuno project in ./my-app...

  Cloning repository... done
  Installing dependencies... done
  Building workspace packages... done

  ? Enter your OpenAI API key: sk-...

  Checking for PostgreSQL...
  > PostgreSQL found (brew, v15.4)

  ? Database URL: postgresql://user:pass@localhost:5432/hissuno
    (or press Enter to create a new "hissuno" database)

  Creating database "hissuno"... done
  Enabling pgvector extension... done
  Verifying pgvector... done
  Pushing schema... done

  ? Seed with demo data? (admin user + sample project) Yes
  Seeding... done

  Hissuno is ready!

  Next steps:
    cd my-app/app
    npm run dev

  Open http://localhost:3000
  Login: admin@hissuno.com / AdminPass123!
```

## Step Sequence

1. **Check Node.js >= 20** - fail early with clear message if too old
2. **Clone repo** into `./my-app` - fail if directory exists
3. **Install dependencies** - `npm install` from `my-app/app/`
4. **Build workspace packages** - `npm run build:widget` (required before dev server works)
5. **Prompt for OpenAI API key**
6. **Detect/install PostgreSQL** (see below)
7. **Write `.env.local`** to `my-app/app/.env.local` with all config values
8. **Setup database** - createdb, pgvector, `npx drizzle-kit push` (reads DATABASE_URL from `.env.local`)
9. **Optional seed** - `npm run db:seed` from `my-app/app/`
10. **Print next steps**

All npm/drizzle commands run with `cwd: my-app/app/`.

## Directory Layout

After `npx create-hissuno my-app` completes:

```
my-app/                         # Repo root (no .git)
  app/                          # Main Next.js app - run commands here
    .env.local                  # Generated config
    package.json
    packages/
      widget/                   # @hissuno/widget (pre-built)
      cli/                      # @hissuno/cli
  README.md
  CONTRIBUTING.md
  LICENSE
```

User runs `cd my-app/app && npm run dev`. The "next steps" output makes this clear.

## PostgreSQL Detection & Installation

Order of operations:

1. Check if `psql` is on PATH (already installed)
2. If not found, detect available package managers and offer to install:
   - **macOS** (if `brew` found): `brew install postgresql@15 && brew install pgvector`, then `brew services start postgresql@15`
   - **Linux** (if `apt-get` found): `sudo apt-get install postgresql-15`, build pgvector from source
   - **Docker** (if `docker` found): `docker run -d --name hissuno-postgres -e POSTGRES_DB=hissuno -e POSTGRES_PASSWORD=hissuno -p 5432:5432 pgvector/pgvector:pg15`
   - Only show options for tools that are actually installed
3. If no package manager available or user declines, prompt for an existing `DATABASE_URL` (e.g. Supabase, Neon, Railway - these include pgvector out of the box)

After Postgres is available:

- Create the `hissuno` database if it doesn't exist (`createdb hissuno`)
- Enable pgvector: `psql hissuno -c "CREATE EXTENSION IF NOT EXISTS vector;"`
- **Verify pgvector**: `psql hissuno -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"` - if no result, fail with installation instructions
- Run `npx drizzle-kit push` from `my-app/app/` (reads `DATABASE_URL` from `.env.local`)

For Docker installs, the DATABASE_URL is auto-constructed: `postgresql://postgres:hissuno@localhost:5432/hissuno`

## Environment Configuration

Auto-generated (no prompt needed):
- `AUTH_SECRET` - `crypto.randomBytes(32).toString('base64')`
- `NEXT_PUBLIC_APP_URL` - `http://localhost:3000`
- `DATABASE_URL` - constructed from Postgres setup or user-provided

Prompted:
- `OPENAI_API_KEY` - required, validated that it starts with `sk-`

Skipped (user adds later):
- Google OAuth, Slack, GitHub, Linear, Jira, Intercom, Gong, storage, analytics, email

## Package Structure

```
app/packages/create-hissuno/
  bin/
    create-hissuno.mjs          # #!/usr/bin/env node entry point
  src/
    index.ts                    # Main flow orchestrator
    steps/
      check-node.ts             # Verify Node.js >= 20
      clone.ts                  # git clone + remove .git directory
      install.ts                # npm install + npm run build:widget
      detect-postgres.ts        # Find psql, offer install if missing
      configure-env.ts          # Prompt for keys, write .env.local
      setup-database.ts         # createdb, pgvector verify, drizzle push
      seed.ts                   # Optional: npm run db:seed
    lib/
      exec.ts                   # Promisified child_process.execFile wrapper
      log.ts                    # Colored terminal output helpers
  package.json
  tsconfig.json
  tsup.config.ts
```

## package.json

```json
{
  "name": "create-hissuno",
  "version": "0.1.0",
  "description": "Create a self-hosted Hissuno instance",
  "bin": {
    "create-hissuno": "./bin/create-hissuno.mjs"
  },
  "files": ["dist", "bin"],
  "dependencies": {
    "@inquirer/prompts": "^7.0.0",
    "commander": "^13.0.0"
  }
}
```

## Key Decisions

- **Clones the full repo** (not a template) - user gets the real Hissuno source
- **Removes `.git` after clone** so user starts fresh. Keeps `.gitignore` and other files.
- **No `--yes` flag for v1** - interactive only to keep it simple
- **No Docker for the app itself** - only for Postgres as a fallback
- **Errors exit cleanly** - print what went wrong and how to fix it manually
- **Port 3000** - standard Next.js default, no custom port
- **Only shows install options for detected tools** - won't offer brew on Linux or apt on macOS

## CLI Arguments

```
npx create-hissuno [project-directory]

Arguments:
  project-directory    Directory to create (default: "hissuno")

Options:
  -V, --version        Show version
  -h, --help           Show help
```

## Error Handling

Each step checks preconditions before running:

- **check-node**: Fail with "Hissuno requires Node.js 20 or later. You have vX.Y.Z."
- **clone**: Fail if target directory already exists
- **install**: Fail with npm error output
- **detect-postgres**: Fail gracefully - offer alternatives (install, docker, manual URL)
- **configure-env**: Validate OpenAI key format starts with `sk-`
- **setup-database**: Verify pgvector after CREATE EXTENSION. If `createdb` fails, show the error and suggest manual creation
- **seed**: Seed failure is non-fatal - warn and continue

## Success Criteria

1. `npx create-hissuno my-app` works on macOS with no Postgres installed (installs via brew)
2. Works on Linux with apt-based distro
3. Works when Postgres is already running locally
4. Works with a remote DATABASE_URL (Supabase/Neon)
5. Docker fallback works when brew/apt unavailable but docker is present
6. After completion, `cd my-app/app && npm run dev` starts a working Hissuno instance
