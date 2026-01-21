# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hissuno is a customer intelligence platform that converts customer conversations into actionable engineering work. It provides an AI support agent powered by product/codebase knowledge, and automatically creates/triages issues from customer feedback.

## Development Commands

All commands run from the `app/` directory:

```bash
# Development
npm run dev                    # Next.js dev server (port 3000)
npm run dev:mastra             # Mastra agent playground

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

### Database (Supabase)

```bash
cd app/supabase
supabase db push               # Push migrations
supabase db reset              # Reset and reseed
supabase gen types typescript --local > ../src/types/supabase.ts  # Regenerate types
```

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript (strict mode)
- **Database/Auth**: Supabase (PostgreSQL with RLS)
- **AI Framework**: Mastra (multi-agent orchestration)
- **AI SDK**: Vercel AI SDK v5 with OpenAI (GPT-5, GPT-4o)
- **Styling**: Tailwind CSS v4 + CSS variables, `motion` for animations
- **Testing**: Vitest
- **3D/WebGL**: React Three Fiber (drei, postprocessing)

## Architecture

### Project Structure

```
app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Login, signup (public)
│   │   ├── (authenticated)/   # Protected dashboard routes
│   │   └── api/               # 45+ API routes
│   ├── components/
│   │   ├── ui/                # Reusable UI primitives
│   │   ├── layout/            # App shell (header, sidebar)
│   │   └── [feature]/         # Feature components (sessions, issues, projects)
│   ├── hooks/                 # Data-fetching hooks (use-*.ts)
│   ├── lib/
│   │   ├── supabase/          # Database queries + client
│   │   ├── auth/              # Auth utilities
│   │   └── [domain]/          # Domain services
│   ├── mastra/
│   │   ├── agents/            # 8 AI agents
│   │   ├── tools/             # Agent tools
│   │   └── workflows/         # Multi-step workflows
│   └── types/                 # TypeScript definitions
├── packages/widget/           # @hissuno/widget npm package
└── supabase/
    └── migrations/            # SQL migrations
```

### AI Agents (Mastra)

| Agent | Purpose |
|-------|---------|
| Support Agent | Powers customer conversations with knowledge tools |
| Product Manager Agent | Analyzes sessions, creates/upvotes issues |
| Codebase Analyzer | Extracts product knowledge from source code |
| Knowledge Compiler | Categorizes findings into business/product/technical |
| Spec Writer | Generates product specifications |
| Security Scanner | Redacts sensitive information |
| Tagging Agent | Classifies sessions with labels |

### Key Workflows

**Knowledge Analysis**: Analyze Codebase → Analyze Sources → Compile → Sanitize → Save Packages

**Session Review**: Classify Session → PM Review → Create/Upvote Issue → (Generate Spec if threshold)

## Critical Patterns

### Never Make Internal HTTP Calls

API routes must never call other API routes via fetch. Import service functions directly:

```typescript
// ❌ Bad
await fetch(`${process.env.NEXT_PUBLIC_URL}/api/other-route`)

// ✅ Good
import { doSomething } from '@/lib/some-service'
await doSomething({ projectId, userId })
```

### API Route Structure

```typescript
import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'

export const runtime = 'nodejs'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }
  try {
    const { supabase, user } = await resolveUser()
    // Query with RLS context - always filter by user_id
    const { data } = await supabase.from('table').select('*').eq('user_id', user.id)
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[route.method] unexpected error', error)
    return NextResponse.json({ error: 'Operation failed.' }, { status: 500 })
  }
}
```

### Data Fetching Hooks

```typescript
export function useSessions(options: { initialSessions?: SessionWithProject[] } = {}) {
  const [sessions, setSessions] = useState(options.initialSessions ?? [])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => { /* ... */ }, [])

  useEffect(() => {
    void fetchSessions()  // void prefix for fire-and-forget
  }, [fetchSessions])

  return useMemo(() => ({ sessions, isLoading, error, refresh: fetchSessions }), [...])
}
```

### SSE Streaming Routes

Use shared utilities from `@/lib/sse`:

```typescript
import { createSSEStreamWithExecutor, createSSEEvent } from '@/lib/sse'

export async function GET(request: Request) {
  return createSSEStreamWithExecutor<MyEventType>({
    logPrefix: '[my-endpoint]',
    executor: async ({ emit, close, isClosed }) => {
      emit(createSSEEvent('connected', { message: 'Connected' }))
      // Do async work, emit progress events
      emit(createSSEEvent('complete', { message: 'Done' }))
      close()
    },
  })
}
```

### Mastra Agent Definition

```typescript
export const myAgent = new Agent({
  name: 'My Agent',
  instructions: `You are an agent that does X...`,
  model: 'openai/gpt-4o',
  tools: Object.fromEntries(myTools.map((tool) => [tool.id, tool])),
})
```

### Mastra Tool Definition

```typescript
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const myTool = createTool({
  id: 'my-tool',
  description: `Description of what this tool does.`,
  inputSchema: z.object({
    param: z.string().describe('Description of parameter'),
  }),
  outputSchema: z.object({
    result: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { param } = context
    return { result: '...', success: true }
  },
})
```

### Mastra Singleton (HMR-safe)

```typescript
// src/mastra/index.ts
const globalForMastra = globalThis as unknown as { mastraStorage: PostgresStore | undefined }

const storage = globalForMastra.mastraStorage ?? new PostgresStore({
  connectionString: process.env.DATABASE_URL!,
  schemaName: 'mastra',
})

if (process.env.NODE_ENV !== 'production') {
  globalForMastra.mastraStorage = storage
}

export const mastra = new Mastra({ workflows, agents, storage, logger })
```

### UI Components (forwardRef pattern)

```typescript
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => {
    return <button ref={ref} className={cn(baseStyles, variants[variant], className)} {...props} />
  }
)
Button.displayName = 'Button'
export { Button }
```

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

## Type Patterns

### Database Types with Extensions

```typescript
// Base from Supabase (auto-generated)
type SessionRecord = Database['public']['Tables']['sessions']['Row']

// Extended with relations
export interface SessionWithProject extends SessionRecord {
  project: { id: string; name: string } | null
}

// Enum-like constants with display info
export const SESSION_TAGS = ['bug', 'feature_request', 'change_request'] as const
export type SessionTag = (typeof SESSION_TAGS)[number]
```

## Path Aliases

```typescript
import { Button } from '@/components/ui'
import { useProjects } from '@/hooks/use-projects'
import type { SessionWithProject } from '@/types/session'
```

## Styling

### CSS Variables (Theming)

```css
:root {
  --background: #ffffff;
  --foreground: #1a1a1a;
  --border: #2a2a2a;
  --accent-primary: #3a3a3a;
  --accent-selected: #2563eb;
}
.dark {
  --background: #0f0f0f;
  --foreground: #e5e5e5;
}
```

### Marketing-Only Accent Colors

The following CSS variables are reserved for marketing pages only:
- `--accent-teal` / `--accent-teal-hover`
- `--accent-warm`
- `--accent-coral`

**Rule**: These colors must ONLY be used in:
- `app/src/app/(marketing)/` routes
- `app/src/components/landing/` components

For app pages (authenticated, auth), use the standard accent colors:
- `--accent-primary` / `--accent-primary-hover` - primary actions
- `--accent-selected` / `--accent-selected-hover` - selected states
- `--accent-success` / `--accent-warning` / `--accent-danger` / `--accent-info` - semantic states

### Tailwind with CSS Variables

```tsx
<div className="bg-[color:var(--background)] text-[color:var(--foreground)]">
```

### Class Name Utility

```typescript
export function cn(...inputs: ClassValue[]): string {
  return inputs.flat().filter((x) => typeof x === 'string' && x.length > 0).join(' ').trim()
}
```

## Error Handling

### Custom Error Classes

```typescript
export class UnauthorizedError extends Error {
  status = 401
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}
```

### Server-Side Cached Queries

```typescript
import { cache } from 'react'

export const listProjects = cache(async (): Promise<ProjectWithCodebase[]> => {
  const supabase = await createClient()
  // ... query
})
```

## Important Notes

1. **No internal HTTP calls**: Never fetch from one API route to another. Use service functions.
2. **Auth everywhere**: All API routes should authenticate via `resolveUser()`.
3. **RLS context**: Always filter queries by `user_id` to work with Supabase RLS.
4. **Runtime**: Use `export const runtime = 'nodejs'` for routes requiring Node.js APIs.
5. **FormData**: Prefer FormData over JSON for POST requests with optional file uploads.
6. **Void promises**: Use `void` prefix for fire-and-forget: `void fetchData()`.
7. **No relative imports**: always use absolute import paths starting with the '@' to reference the root
8. **Use existing UI components**: Before creating any UI element (buttons, headers, text, cards, dialogs, etc.), ALWAYS check `@/components/ui` for existing components. Never create elements from scratch when a reusable component exists.

## Environment Variables

Required in `.env.local`:
```
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```
