# AGENTS.md

AI coding agent guide for the Hissuno codebase. See `docs/` for detailed architecture and pattern documentation.

## Project Overview

Hissuno is an open-source unified context layer for product agents. It ingests codebases, docs, and customer signals into an interconnected knowledge graph - where sessions, contacts, issues, product areas, and knowledge sources are all linked. Any AI agent can traverse and query this graph natively via MCP, CLI, API, embedded widget, or Slack integration.

## Development Commands

All commands run from the `app/` directory:

```bash
# Development
npm run dev                    # Next.js dev server (port 3000)
npm run dev:mastra             # Mastra agent playground
npm run mcp:dev               # MCP server development

# Build & Production
npm run build                  # Build Next.js app
npm run start                  # Start production server

# Testing
npm run test                   # Run all tests
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only
npm run test:watch             # Watch mode

# Run a single test file
npx vitest run path/to/file.test.ts

# Run tests matching a pattern
npx vitest run -t "pattern"

# Linting
npm run lint                   # ESLint

# AI Evaluations
npm run eval:pm-agent          # Run PM agent evaluations
npm run eval:pm-agent:verbose  # Verbose output
```

### Database (Drizzle ORM)

```bash
npx drizzle-kit generate       # Generate migration from schema changes
npx drizzle-kit push           # Push schema to database (dev)
npx drizzle-kit migrate        # Run pending migrations (production)
npx drizzle-kit studio         # Visual schema browser
```

#### Running migrations locally

`drizzle-kit migrate` fails locally because older migrations reference tables that were already renamed/dropped in the current database (the `__drizzle_migrations` tracker is out of sync).

**Workaround - run migration SQL directly via psql:**

```bash
cd app
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d'=' -f2-)
psql "$DATABASE_URL" < src/lib/db/migrations/<migration-file>.sql
```

The `-->  statement-breakpoint` comments in migration files are harmless to psql.

**For schema changes** (add/drop columns, create tables), `npx drizzle-kit push` is the simplest option - it diffs the Drizzle schema against the live DB and applies changes directly, bypassing the migration journal entirely.

**Notes:**
- Do not use `CREATE INDEX CONCURRENTLY` in migration files - Drizzle wraps migrations in a transaction, and `CONCURRENTLY` is not allowed inside transactions. Use `CREATE INDEX` instead.
- Do not use `source .env.local` to load env vars - the file contains multiline values that break shell parsing. Use the `grep`/`cut` pattern shown above.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL + Drizzle ORM (any provider: Supabase, Neon, Railway, local)
- **Auth**: AuthJS v5 (next-auth) with Google OAuth + Credentials
- **AI Framework**: Mastra (multi-agent orchestration)
- **AI SDK**: Vercel AI SDK v5 with OpenAI (GPT-5, gpt-5.4)
- **Styling**: Tailwind CSS v4 + CSS variables, `motion` for animations
- **Testing**: Vitest
- **3D/WebGL**: React Three Fiber (drei, postprocessing)

## Project Structure

```
app/
├── src/
│   ├── proxy.ts               # Next.js 16 proxy (auth gateway)
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Login, signup (public)
│   │   ├── (authenticated)/   # Protected dashboard routes
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── ui/                # Reusable UI primitives
│   │   ├── layout/            # App shell (header, sidebar)
│   │   └── [feature]/         # Feature components (sessions, issues, projects)
│   ├── hooks/                 # Data-fetching hooks (use-*.ts)
│   ├── lib/
│   │   ├── db/                # Drizzle ORM client, schema, and queries
│   │   │   ├── index.ts       # Drizzle client singleton
│   │   │   ├── config.ts      # isDatabaseConfigured() check
│   │   │   ├── server.ts      # resolveRequestContext() - { db, userId, apiKeyProjectId }
│   │   │   ├── schema/        # auth.ts, app.ts, relations.ts, custom-types.ts
│   │   │   └── queries/       # All data access queries (sessions, issues, contacts, etc.)
│   │   ├── storage/           # File storage (local filesystem or S3)
│   │   ├── auth/              # Auth config (AuthJS) + utilities
│   │   └── [domain]/          # Domain services
│   ├── mastra/
│   │   ├── agents/            # AI agents
│   │   ├── tools/             # Agent tools
│   │   └── workflows/         # Multi-step workflows
│   ├── mcp/                   # MCP server (graph access for external agents)
│   └── types/                 # TypeScript definitions
└── packages/widget/           # @hissuno/widget npm package
```

## AI Agents (Mastra)

| Agent | Purpose |
|-------|---------|
| Support Agent | Primary conversational AI for customer support and team interactions |
| Product Manager Agent | Analyzes sessions, creates/upvotes issues |
| Codebase Analyzer | Extracts product knowledge from source code |
| Web Scraper | Analyzes website content for product knowledge |
| Technical Analyst | Performs deep technical analysis on issues |
| Feedback Decision Agent | Decides how to handle and route incoming feedback |
| Response Classifier | Classifies session content and routes responses |
| Brief Writer | Generates product briefs |
| Security Scanner | Redacts sensitive information |
| Tagging Agent | Classifies sessions with labels |

## Key Workflows

**Knowledge Analysis**: Analyze Sources - Source Analysis - Compile - Sanitize - Save Packages

**Source Analysis**: Fetch Content - Sanitize - Save and Embed

**Session Review**: Classify Session - PM Decision - Execute Decision - (Generate Brief if threshold)

**Issue Analysis**: Prepare Context - Analyze Impact/Effort - Compute Scores - (Generate Brief)

## Naming Conventions

| Category | Pattern | Example |
|----------|---------|---------|
| Files | kebab-case | `session-sidebar.tsx`, `use-sessions.ts` |
| Components | PascalCase | `SessionSidebar` |
| Functions/Hooks | camelCase | `useSessionDetail`, `listSessions` |
| Types | PascalCase | `SessionWithProject` |
| Constants | UPPER_SNAKE_CASE | `SESSION_TAGS` |
| CSS Variables | --kebab-case | `--accent-primary` |

### Logging

Use bracketed prefixes: `console.log('[route.method] message', data)`

## Path Aliases

```typescript
import { Button } from '@/components/ui'
import { useProjects } from '@/hooks/use-analytics'
import type { SessionWithProject } from '@/types/session'
```

## UI Design System - Lean Design

The UI follows a **lean, high-density design** with icon+text action buttons and tight spacing. The aesthetic is terminal-inspired: font-mono, uppercase labels, sharp corners (rounded-[4px]), and border-2 accents.

### Action Button Hierarchy

Actions use three tiers of visual weight:

| Tier | Component | Use Case | Example |
|------|-----------|----------|---------|
| **Primary** | `<Button>` | Major CTAs, dialog footers (Save, Create, Connect) | `<Button size="sm">Save</Button>` |
| **Secondary** | Inline icon+text button | Page actions, batch actions, toolbar controls | `<button className="lean-action">...</button>` |
| **Tertiary** | `<IconButton>` | Row-level actions, close buttons, refresh | `<IconButton aria-label="Edit">...</IconButton>` |

### Lean Action Pattern (Tier 2)

The standard lean action button is an inline icon+text element used throughout page headers, batch bars, sidebars, and list actions:

```tsx
<button className="inline-flex items-center gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]">
  <Plus size={14} />
  Add Item
</button>
```

Key properties:
- **Icon size**: 14px (lucide-react icons at `size={14}`)
- **Gap**: gap-1.5 between icon and label
- **Font**: text-xs, font-medium (NOT uppercase, NOT font-mono - those are for `<Button>`)
- **Padding**: px-2.5 py-1.5
- **Border**: border border-[color:var(--border-subtle)] (optional - omit for ghost feel)
- **Hover**: hover:bg-[color:var(--surface-hover)] + hover:text-[color:var(--foreground)]

### Spacing & Density

Use tight spacing throughout:

| Context | Spacing |
|---------|---------|
| Card padding | p-4 (prefer over p-6) |
| Dialog header/content | p-3 to p-4 |
| Section gaps | gap-3 to gap-4 |
| Button groups | gap-1.5 to gap-2 |
| List item padding | px-2 py-1.5 to px-3 py-2 |
| Tab lists | px-4 py-1.5 |
| Individual tabs | px-3 py-1.5 |

### Interaction Patterns

- **Clickable rows**: Entire list items/cards are clickable to open sidebar or dialog - avoid per-row action buttons when sidebar covers the use case
- **Hover-reveal actions**: For row-level actions (edit, delete), show on hover only to reduce visual noise
- **Batch actions**: Use `<BatchActionBar>` with icon+label buttons for multi-select operations
- **Dialogs for creation/editing**: Open dialog on primary actions (create, configure), sidebar for detail views
- **ToggleGroup for config choices**: Use `<ToggleGroup>` with icon+label options instead of radio groups or multiple buttons

### Icon Usage

- Use `lucide-react` icons exclusively
- Inline actions: `size={14}`
- List/card icons: `size={16}` to `size={20}`
- Navigation icons: `size={16}`
- Never use raw inline SVGs for standard icons - import from lucide-react

### CSS Variables (Theme)

All colors use CSS variables for light/dark theming:
- Text: `--foreground`, `--text-secondary`, `--text-tertiary`
- Surfaces: `--background`, `--surface`, `--surface-hover`
- Borders: `--border`, `--border-subtle`
- Accents: `--accent-primary`, `--accent-selected`, `--accent-danger`, `--accent-success`, `--accent-warning`, `--accent-info`

## Important Notes

1. **No internal HTTP calls**: Never fetch from one API route to another. Use service functions.
2. **Auth everywhere**: All API routes authenticate via `requireRequestIdentity()` (from `@/lib/auth/identity`). Public routes must be added to the `PUBLIC_PATHS` array in `src/proxy.ts`.
3. **Application-level access control**: All queries use `db` from `@/lib/db` (Drizzle singleton). Always filter by `project_id`/`user_id` explicitly - no RLS.
4. **Runtime**: Use `export const runtime = 'nodejs'` for routes requiring Node.js APIs.
5. **FormData**: Prefer FormData over JSON for POST requests with optional file uploads.
6. **Void promises**: Use `void` prefix for fire-and-forget: `void fetchData()`.
7. **No relative imports**: Always use absolute import paths starting with `@/` to reference the root.
8. **Use existing UI components**: Before creating any UI element, ALWAYS check `@/components/ui` for existing components. Never create elements from scratch when a reusable component exists.
9. **User-facing text**: Use "Feedback" instead of "Session" in all user-facing text. "Session" is an internal/code term only.

## Environment Variables

Required in `.env.local`:
```
DATABASE_URL=                   # PostgreSQL connection string (any provider)
OPENAI_API_KEY=
AUTH_SECRET=                    # openssl rand -base64 32
AUTH_GOOGLE_ID=                 # Google OAuth client ID
AUTH_GOOGLE_SECRET=             # Google OAuth client secret
```

Optional:
```
STORAGE_PROVIDER=local          # "local" (default) or "s3"
S3_ENDPOINT=                    # S3-compatible endpoint
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
```
