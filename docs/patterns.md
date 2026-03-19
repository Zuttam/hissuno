# Code Patterns

Templates and conventions for common patterns in the codebase.

## API Route Structure

```typescript
import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { myTable } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }
  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const data = await db.select().from(myTable).where(eq(myTable.project_id, projectId))
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[route.method] unexpected error', error)
    return NextResponse.json({ error: 'Operation failed.' }, { status: 500 })
  }
}
```

## Data Fetching Hooks

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

## SSE Streaming Routes

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

## Mastra Agent Definition

```typescript
export const myAgent = new Agent({
  name: 'My Agent',
  instructions: `You are an agent that does X...`,
  model: 'openai/gpt-4o',
  tools: Object.fromEntries(myTools.map((tool) => [tool.id, tool])),
})
```

## Mastra Tool Definition

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

## Mastra Singleton (HMR-safe)

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

## UI Components (forwardRef pattern)

```typescript
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => {
    return <button ref={ref} className={cn(baseStyles, variants[variant], className)} {...props} />
  }
)
Button.displayName = 'Button'
export { Button }
```

## Inline Edit Pattern (sidebar detail fields)

For editable fields in sidebar detail views, use the hover-to-reveal edit icon pattern from `contact-sidebar.tsx`:

- **Read mode**: `group` wrapper, value on left, edit pencil icon button with `opacity-0 group-hover:opacity-100`
- **Edit mode**: Input or `Combobox` with save (checkmark) + cancel (X) icon buttons
- Both modes share `flex flex-col gap-1` layout with a `label` on top

```tsx
// Read mode
<div className="group flex flex-col gap-1">
  <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">{label}</label>
  <div className="flex items-center gap-1">
    <p className="flex-1 text-[color:var(--foreground)]">{value || '-'}</p>
    <button
      onClick={handleStartEdit}
      className="rounded-[4px] p-1 text-[color:var(--text-secondary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] group-hover:opacity-100"
      aria-label={`Edit ${label}`}
    >
      {/* pencil icon 12x12 */}
    </button>
  </div>
</div>

// Edit mode
<div className="flex flex-col gap-1">
  <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">{label}</label>
  <div className="flex items-center gap-1">
    <input className="flex-1 rounded-[4px] border ..." autoFocus />
    <button className="... text-[color:var(--accent-success)]">{/* checkmark */}</button>
    <button className="... text-[color:var(--accent-danger)]">{/* X icon */}</button>
  </div>
</div>
```

For relation fields (company, contact), use `Combobox` instead of `<input>` in edit mode. See `EditableCompanyField` in `contact-sidebar.tsx` and the Customer field in `session-details.tsx` for reference.

## Type Patterns

### Database Types with Extensions

```typescript
// Base from Drizzle schema (inferred)
import { sessions } from '@/lib/db/schema/app'
type SessionRow = typeof sessions.$inferSelect
type SessionInsert = typeof sessions.$inferInsert

// Extended with relations
export interface SessionWithProject extends SessionRow {
  project: { id: string; name: string } | null
}

// Enum-like constants with display info
export const SESSION_TAGS = ['bug', 'feature_request', 'change_request'] as const
export type SessionTag = (typeof SESSION_TAGS)[number]
```

**Note**: Drizzle returns `Date` objects for timestamp columns (not ISO strings). Use `.toISOString()` when serializing for API responses.

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
import { getSessionUser, UnauthorizedError } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { projects, projectMembers } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'

export const listProjects = cache(async (): Promise<ProjectRecord[]> => {
  const user = await getSessionUser()
  if (!user) throw new UnauthorizedError()
  // ... query with explicit user_id/project_id filtering using db
})
```
