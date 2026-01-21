# Support Module Migration Plan

## Overview

Consolidate Knowledge, Slack, Widget, and Support Agent configuration into a unified "Support" module under project scope.

**Key changes:**
- New `src/lib/support/` module with knowledge, channels, and agent submodules
- New routes at `/projects/[id]/support/*`
- Knowledge becomes a sub-module of Support
- Widget and Slack become "channels" under Support
- New database tables for agent and channel configuration

## Architecture

```
src/lib/support/
├── index.ts
├── types.ts
├── knowledge/          # From src/lib/knowledge/
├── channels/
│   ├── widget/         # New - extracted from widget routes
│   └── slack/          # From src/lib/integrations/slack/
└── agent/
    ├── config.ts       # Agent behavior settings
    └── stats.ts        # Analytics queries (from sessions)
```

**Route structure:**
```
/projects/[id]/support/           # Overview with stats
/projects/[id]/support/knowledge  # Knowledge management
/projects/[id]/support/channels   # Widget, Slack config
/projects/[id]/support/agent      # Agent behavior settings
```

**API routes:**
- OAuth flows stay at `/api/integrations/slack/connect|callback`
- Webhooks stay at `/api/webhooks/slack`
- Management routes move to `/api/projects/[id]/support/channels/*`

---

## Phase 1: Foundation

### 1.1 Create directory structure
```bash
src/lib/support/
├── index.ts
├── types.ts
├── knowledge/
├── channels/
│   ├── index.ts
│   ├── types.ts
│   ├── widget/
│   └── slack/
└── agent/
    ├── index.ts
    ├── config.ts
    └── stats.ts
```

### 1.2 Database migration
Create `supabase/migrations/XXXXXX_support_module.sql`:

```sql
-- Agent configuration per project
CREATE TABLE support_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tone TEXT DEFAULT 'professional',
  verbosity TEXT DEFAULT 'balanced',
  max_questions_per_turn INTEGER DEFAULT 2,
  escalation_enabled BOOLEAN DEFAULT false,
  escalation_keywords TEXT[],
  preferred_categories TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- Channel configurations per project
CREATE TABLE support_channel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, channel_type)
);

-- RLS policies
ALTER TABLE support_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_channel_configs ENABLE ROW LEVEL SECURITY;

-- Policies following existing patterns (user owns project)
CREATE POLICY "Users can manage their project agent configs"
  ON support_agent_configs FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their project channel configs"
  ON support_channel_configs FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
```

### 1.3 Create base types
File: `src/lib/support/types.ts`

```typescript
export type SupportChannelType = 'widget' | 'slack' | 'email'

export interface SupportAgentConfig {
  id: string
  projectId: string
  tone: 'professional' | 'friendly' | 'concise'
  verbosity: 'brief' | 'balanced' | 'detailed'
  maxQuestionsPerTurn: number
  escalationEnabled: boolean
  escalationKeywords: string[]
  preferredCategories: string[]
}

export interface SupportChannelConfig {
  id: string
  projectId: string
  channelType: SupportChannelType
  enabled: boolean
  config: Record<string, unknown>
}

export interface SupportStats {
  totalSessions: number
  avgResponseTime: number
  sessionsByChannel: Record<SupportChannelType, number>
  resolutionRate: number
}
```

---

## Phase 2: Move Knowledge

### 2.1 Move files
```
src/lib/knowledge/* → src/lib/support/knowledge/
```

Files to move:
- `index.ts`
- `types.ts`
- `storage.ts`
- `analysis-service.ts`
- `embedding-service.ts`
- `chunking.ts`
- `docs-crawler.ts`

### 2.2 Update imports
Search and replace across codebase:
- `@/lib/knowledge` → `@/lib/support/knowledge`

Affected locations:
- `src/app/api/projects/[id]/knowledge/*` routes
- `src/mastra/agents/*` (support agent, codebase analyzer, etc.)
- `src/mastra/workflows/*`
- `src/components/projects/shared/wizard/steps/knowledge-step/`

### 2.3 Re-export from support index
File: `src/lib/support/index.ts`
```typescript
export * from './knowledge'
export * from './types'
```

---

## Phase 3: Move Channels

### 3.1 Move Slack
```
src/lib/integrations/slack/* → src/lib/support/channels/slack/
```

Files to move:
- `index.ts`
- `client.ts`
- `event-handlers.ts`
- `message-processor.ts`

Add new:
- `config.ts` - Slack-specific configuration helpers

### 3.2 Create Widget channel
New files in `src/lib/support/channels/widget/`:
- `index.ts` - exports
- `config.ts` - widget configuration helpers
- `chat-handler.ts` - extracted from current widget API routes

### 3.3 Update imports
Search and replace:
- `@/lib/integrations/slack` → `@/lib/support/channels/slack`

Affected locations:
- `src/app/api/integrations/slack/*` (OAuth routes - keep location, update imports)
- `src/app/api/webhooks/slack/route.ts`

### 3.4 Migrate API routes

**Keep in place (OAuth/webhooks):**
- `/api/integrations/slack/connect/route.ts` - update imports only
- `/api/integrations/slack/callback/route.ts` - update imports only
- `/api/webhooks/slack/route.ts` - update imports only

**Move to new location:**
```
/api/integrations/slack/route.ts (GET status, DELETE)
  → /api/projects/[id]/support/channels/slack/route.ts

/api/integrations/slack/channels/route.ts
  → /api/projects/[id]/support/channels/slack/channels/route.ts

/api/integrations/widget/*
  → /api/projects/[id]/support/channels/widget/*
```

### 3.5 Channel abstraction layer
File: `src/lib/support/channels/index.ts`

```typescript
export type { SupportChannelType } from '../types'
export * from './slack'
export * from './widget'

// Unified channel utilities
export function getChannelConfig(projectId: string, channelType: SupportChannelType) { ... }
export function updateChannelConfig(projectId: string, channelType: SupportChannelType, config: Record<string, unknown>) { ... }
```

---

## Phase 4: Agent Config

### 4.1 Create agent config service
File: `src/lib/support/agent/config.ts`

```typescript
export async function getAgentConfig(projectId: string): Promise<SupportAgentConfig | null>
export async function upsertAgentConfig(projectId: string, config: Partial<SupportAgentConfig>): Promise<SupportAgentConfig>
```

### 4.2 Create stats service
File: `src/lib/support/agent/stats.ts`

```typescript
export async function getSupportStats(projectId: string, dateRange?: DateRange): Promise<SupportStats>
```

Query from sessions table:
- Total sessions by project
- Average response time (from message timestamps)
- Sessions grouped by channel/source
- Resolution rate (closed sessions / total)

### 4.3 Wire to Mastra support agent
Update `src/mastra/agents/support-agent.ts`:
- Load agent config at start of conversation
- Apply tone/verbosity settings to system prompt
- Respect max questions per turn
- Check escalation keywords

---

## Phase 5: UI Pages

### 5.1 Create route structure
```
src/app/(authenticated)/projects/[id]/support/
├── page.tsx              # Overview with stats dashboard
├── layout.tsx            # Sub-navigation
├── knowledge/
│   └── page.tsx          # Knowledge sources management
├── channels/
│   ├── page.tsx          # Channel overview
│   ├── widget/
│   │   └── page.tsx      # Widget configuration
│   └── slack/
│       └── page.tsx      # Slack configuration
└── agent/
    └── page.tsx          # Agent behavior settings
```

### 5.2 Support overview page
- Stats cards: total sessions, avg response time, resolution rate
- Sessions by channel chart
- Quick links to configure each channel
- Recent activity feed

### 5.3 Knowledge page
- Migrate existing knowledge UI from project wizard/settings
- List knowledge sources with status
- Trigger analysis workflow
- View/export knowledge packages

### 5.4 Channels page
- Card for each channel (Widget, Slack, Email placeholder)
- Status indicator (connected/enabled/disabled)
- Quick configure button

### 5.5 Widget config page
- Appearance settings (theme, position, colors)
- Behavior settings (welcome message, placeholder)
- Embed code snippet

### 5.6 Slack config page
- Connection status
- Connected workspace info
- Channel selection for auto-join
- Disconnect button

### 5.7 Agent settings page
- Tone selector (professional/friendly/concise)
- Verbosity selector (brief/balanced/detailed)
- Max questions per turn
- Escalation keywords
- Knowledge category preferences

### 5.8 Update navigation
- Add "Support" to project sidebar/tabs
- Remove standalone "Knowledge" link (now under Support)
- Update any hardcoded navigation

---

## Verification

### Build & Lint
```bash
cd app
npm run build
npm run lint
```

### Database
```bash
cd app/supabase
supabase db push
supabase gen types typescript --local > ../src/types/supabase.ts
```

### Test existing functionality
1. Knowledge analysis workflow still works
2. Widget chat still works (via new routes)
3. Slack integration still works (OAuth flow, message handling)
4. Support agent responds correctly

### Test new functionality
1. Agent config saves and loads
2. Channel configs save and load
3. Stats display correctly on overview page
4. Navigation works across all new pages

---

## Files to Modify (Summary)

**New files:**
- `src/lib/support/*` (entire module)
- `src/app/(authenticated)/projects/[id]/support/*` (all pages)
- `supabase/migrations/XXXXXX_support_module.sql`

**Move:**
- `src/lib/knowledge/*` → `src/lib/support/knowledge/`
- `src/lib/integrations/slack/*` → `src/lib/support/channels/slack/`

**Update imports:**
- All files importing from `@/lib/knowledge`
- All files importing from `@/lib/integrations/slack`
- Mastra agents and workflows

**Delete after migration:**
- `src/lib/knowledge/` (empty directory)
- `src/lib/integrations/slack/` (empty directory)
- Old widget routes under `/api/integrations/widget/`
