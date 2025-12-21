---
name: Session Tracking Feature
overview: "Implement end-to-end session tracking: capture user_id and page context from widget, store session metadata in Supabase, fetch messages on-demand from Mastra, and build a Sessions UI with table, filters, and detail sidebar."
todos:
  - id: widget-props
    content: Add userId prop and page context capture to widget
    status: completed
  - id: db-migration
    content: Create sessions table migration
    status: completed
  - id: backend-tracking
    content: Update copilotkit route to extract metadata and upsert session
    status: completed
  - id: sessions-lib
    content: Create src/lib/supabase/sessions.ts with CRUD functions
    status: completed
  - id: api-routes
    content: Create /api/sessions routes (list, detail, messages)
    status: completed
  - id: hooks
    content: Create use-sessions.ts hook
    status: completed
  - id: sessions-page
    content: Create /sessions page with table and filters
    status: completed
  - id: session-sidebar
    content: Create session detail sidebar with chat view
    status: completed
  - id: nav-update
    content: Enable Sessions nav item in layout
    status: completed
  - id: project-sessions
    content: Add sessions section to project detail page
    status: completed
---

# Session Tracking and Visibility Feature

## Data Architecture Decision

**Hybrid approach** (recommended based on your consideration):

- **Session metadata** stored in `public.sessions` table (our schema)
- **Messages** fetched on-demand from Mastra storage via `storage.getMessages({ threadId })`

This avoids data duplication while enabling efficient session listing/filtering in Supabase.

---

## 1. Widget Changes

**Files:** `packages/widget/src/types.ts`, `packages/widget/src/CustomizeWidget.tsx`

### Add Props

```typescript
// types.ts - Add to CustomizeWidgetProps
userId?: string;           // Optional end-user identifier
userMetadata?: Record<string, string>; // Optional user metadata (name, email, etc.)
```

### Capture Page Context & Send Headers

```typescript
// CustomizeWidget.tsx
const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
const pageTitle = typeof window !== 'undefined' ? document.title : '';

const requestHeaders = {
  ...headers,
  'X-Public-Key': publicKey,
  'X-Project-ID': projectId,
  'X-User-ID': userId || '',           // NEW
  'X-Page-URL': pageUrl,               // NEW
  'X-Page-Title': pageTitle,           // NEW
};
```

---

## 2. Database Migration

**File:** `supabase/migrations/YYYYMMDD_add_sessions.sql`

```sql
CREATE TABLE public.sessions (
  id text PRIMARY KEY,                    -- threadId from CopilotKit/Mastra
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id text,                           -- end-user ID from widget
  user_metadata jsonb DEFAULT '{}',       -- optional user info
  page_url text,
  page_title text,
  message_count integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  first_message_at timestamptz,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX sessions_project_id_idx ON public.sessions(project_id);
CREATE INDEX sessions_user_id_idx ON public.sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX sessions_last_activity_idx ON public.sessions(last_activity_at DESC);
CREATE INDEX sessions_status_idx ON public.sessions(status);
```

---

## 3. Backend Session Tracking

**File:** `src/app/api/copilotkit/route.ts`

### Extract Metadata & Upsert Session

```typescript
// Extract from headers
const userId = req.headers.get('X-User-ID') || null;
const pageUrl = req.headers.get('X-Page-URL') || null;
const pageTitle = req.headers.get('X-Page-Title') || null;

// Parse request body to get threadId (CopilotKit sends it in GraphQL mutation)
const body = await req.clone().json();
const threadId = body?.variables?.data?.threadId;

if (threadId && project) {
  await upsertSession({
    id: threadId,
    projectId: project.id,
    userId,
    pageUrl,
    pageTitle,
  });
}
```

**New File:** `src/lib/supabase/sessions.ts`

```typescript
export async function upsertSession(params: {
  id: string;
  projectId: string;
  userId?: string | null;
  pageUrl?: string | null;
  pageTitle?: string | null;
}) { /* ... */ }

export async function listSessions(filters: SessionFilters): Promise<Session[]> { /* ... */ }
export async function getSessionById(sessionId: string): Promise<Session | null> { /* ... */ }
export async function incrementMessageCount(sessionId: string): Promise<void> { /* ... */ }
```

---

## 4. API Routes for Sessions

**Files:**

- `src/app/api/sessions/route.ts` - List sessions with filters
- `src/app/api/sessions/[id]/route.ts` - Get session details + messages (fetched from Mastra)

### Session Detail Endpoint (includes messages)

```typescript
// src/app/api/sessions/[id]/route.ts
import { mastra } from '@/mastra';
import { parseMastraMessages } from '@/lib/utils/mastra/parse-messages';

export async function GET(req, { params }) {
  const { id: sessionId } = await params;
  
  // Get session metadata from Supabase
  const session = await getSessionById(sessionId);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  // Fetch messages from Mastra storage
  const storage = mastra.getStorage();
  const result = await storage.getMessages({ threadId: sessionId });
  
  // Parse to frontend-friendly format
  const messages = parseMastraMessages(result.messages);
  
  return NextResponse.json({ session, messages });
}
```

---

## 4.1 Mastra Message Parser

**Files:**

- `src/lib/utils/mastra/parse-messages.ts` - Parse utility
- `src/types/session.ts` - Frontend types

### Types

```typescript
// src/types/session.ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;  // ISO string
}

export interface SessionWithMessages {
  session: Session;
  messages: ChatMessage[];
}
```

### Parse Utility

```typescript
// src/lib/mastra/parse-messages.ts
import type { MastraDBMessage } from '@mastra/core'; // or infer from storage
import type { ChatMessage } from '@/types/session';

/**
 * Transforms Mastra's internal message format to a clean frontend-friendly format
 */
export function parseMastraMessages(mastraMessages: MastraDBMessage[]): ChatMessage[] {
  return mastraMessages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: extractContent(msg.content),
      createdAt: msg.createdAt?.toISOString() ?? new Date().toISOString(),
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function extractContent(content: unknown): string {
  // Mastra stores content in various formats - normalize to string
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && content !== null) {
    if ('content' in content) return String((content as any).content);
    if ('text' in content) return String((content as any).text);
    return JSON.stringify(content);
  }
  return String(content ?? '');
}
```

---

## 5. Sessions Page UI

**Files:**

- `src/app/(authenticated)/sessions/page.tsx`
- `src/components/sessions/sessions-page.tsx`
- `src/components/sessions/sessions-table.tsx`
- `src/components/sessions/sessions-filters.tsx`
- `src/components/sessions/session-sidebar.tsx`
- `src/components/sessions/session-chat.tsx`
- `src/hooks/use-sessions.ts`

### Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Sessions                                                    [Filters Row]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐  ┌──────────────────────────┐ │
│ │ Sessions Table                            │  │ Session Sidebar          │ │
│ │ - ID | User | Project | Page | Time | ... │  │ ┌──────────────────────┐ │ │
│ │ - Row 1 (clickable)                       │  │ │ Session Details      │ │ │
│ │ - Row 2                                   │  │ │ - ID, User, Project  │ │ │
│ │ - Row 3                                   │  │ │ - Page, Time, Status │ │ │
│ │                                           │  │ └──────────────────────┘ │ │
│ │                                           │  │ ┌──────────────────────┐ │ │
│ │                                           │  │ │ Conversation         │ │ │
│ │                                           │  │ │ (Chat-like view)     │ │ │
│ │                                           │  │ │ - User: ...          │ │ │
│ │                                           │  │ │ - Assistant: ...     │ │ │
│ └───────────────────────────────────────────┘  │ └──────────────────────┘ │ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filters (reuse existing UI components)

```typescript
// sessions-filters.tsx - Uses Input, Select from @/components/ui
<div className="flex gap-4">
  <Select value={projectFilter}>...</Select>  // Project dropdown
  <Input placeholder="User ID..." />          // User search
  <Input placeholder="Session ID..." />       // Session search
  <Input type="date" />                       // Date range
  <Select value={statusFilter}>...</Select>   // Status (active/closed)
</div>
```

### Table Component

```typescript
// sessions-table.tsx - Custom table (no DataTable library exists)
<table className="w-full font-mono text-sm">
  <thead>
    <tr className="border-b-2 border-[--border-subtle]">
      <th>Session</th><th>User</th><th>Project</th><th>Page</th><th>Messages</th><th>Last Activity</th>
    </tr>
  </thead>
  <tbody>
    {sessions.map(session => (
      <tr key={session.id} onClick={() => onSelect(session)} className="cursor-pointer hover:bg-[--surface-hover]">
        ...
      </tr>
    ))}
  </tbody>
</table>
```

### Sidebar Component

```typescript
// session-sidebar.tsx - Slides in from right when session selected
<aside className="fixed right-0 top-0 h-full w-[480px] border-l-2 border-[--border-subtle] bg-[--background]">
  <SessionDetails session={session} />
  <SessionChat messages={messages} />
</aside>
```

---

## 6. Navigation Update

**File:** `src/app/(authenticated)/layout.tsx`

```typescript
const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/sessions', label: 'Sessions' },  // Enable this (was disabled)
  { href: '/user-assets', label: 'User Assets', disabled: true },
]
```

---

## 7. Project Detail Sessions Section

**File:** `src/components/projects/project-detail/index.tsx`

Add a new card/section showing recent sessions for the project with a "View All Sessions" link.

```typescript
// New component: project-sessions-card.tsx
<Card>
  <div className="flex justify-between items-center mb-4">
    <h3>Recent Sessions</h3>
    <Link href={`/sessions?project=${projectId}`}>View All →</Link>
  </div>
  <div className="space-y-2">
    {recentSessions.map(s => <SessionRow key={s.id} session={s} />)}
  </div>
</Card>
```

---

## Key Files Summary

| Area | Files to Create/Modify |

|------|----------------------|

| Widget | `packages/widget/src/types.ts`, `packages/widget/src/CustomizeWidget.tsx` |

| Database | `supabase/migrations/YYYYMMDD_add_sessions.sql` |

| Backend | `src/app/api/copilotkit/route.ts`, `src/lib/supabase/sessions.ts` |

| API | `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/route.ts`, `src/app/api/sessions/[id]/messages/route.ts` |

| Hooks | `src/hooks/use-sessions.ts` |

| Components | `src/components/sessions/` (5 new files) |

| Pages | `src/app/(authenticated)/sessions/page.tsx` |

| Navigation | `src/app/(authenticated)/layout.tsx` |

| Project Detail | `src/components/projects/project-detail/project-sessions-card.tsx`, `index.tsx` |

| Types | `src/types/supabase.ts` (regenerate after migration) |