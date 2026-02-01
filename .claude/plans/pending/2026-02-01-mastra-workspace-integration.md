---
status: pending
created: 2026-02-01
impact: high
summary: Integrate Mastra workspace feature for project-scoped file access and user-defined skills
---

# Plan: Mastra Workspace Integration

## Overview

Integrate Mastra's workspace feature into Hissuno to provide:
1. **Project Workspaces**: Per-project isolated environments for codebase and knowledge access
2. **User-Defined Skills**: Custom agent behaviors based on integrations and custom instructions

## Architecture Decision

**SupabaseFilesystemProvider** (SaaS-first approach):
- Custom filesystem provider wrapping Supabase Storage
- Maintains existing RLS security model
- No data copying - files stay in Supabase Storage buckets
- Path-based isolation: `{project_id}/{category}/{file}`

---

## Database Schema

### New Tables

```sql
-- 1. Project Workspaces (metadata)
CREATE TABLE public.project_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  named_package_id uuid REFERENCES public.named_knowledge_packages(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'indexing', 'ready', 'error')),
  file_count integer DEFAULT 0,
  total_size_bytes bigint DEFAULT 0,
  last_indexed_at timestamptz,
  index_version integer NOT NULL DEFAULT 1,
  bm25_enabled boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, named_package_id)
);

-- 2. Workspace File Index (for BM25 search and file discovery)
CREATE TABLE public.workspace_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.project_workspaces(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL, -- 'knowledge', 'document', 'codebase'
  content_preview text, -- First N chars for BM25
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content_preview, ''))) STORED,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, file_path)
);

-- 3. Codebase Snapshots (persisted analyzed codebase for PM agent access)
CREATE TABLE public.codebase_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.project_workspaces(id) ON DELETE CASCADE,
  source_code_id uuid REFERENCES public.source_codes(id) ON DELETE SET NULL,
  commit_sha text,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  file_count integer DEFAULT 0,
  total_size_bytes bigint DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'ready', 'error')),
  UNIQUE (workspace_id)
);

CREATE INDEX workspace_files_search_idx ON public.workspace_files USING gin(search_vector);

-- 4. Project Skills
CREATE TABLE public.project_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  skill_type text NOT NULL CHECK (skill_type IN ('system', 'integration', 'custom')),
  config jsonb NOT NULL DEFAULT '{}',
  -- config structure: { triggers, tools, instructions, model_override, enabled }
  integration_type text, -- 'slack', 'github', 'intercom'
  version integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);
```

---

## File Structure

```
app/src/lib/
├── workspace/
│   ├── index.ts
│   ├── types.ts
│   ├── workspace-service.ts          # CRUD operations
│   ├── workspace-manager.ts          # Lifecycle & RuntimeContext injection
│   ├── providers/
│   │   └── supabase-filesystem.ts    # SupabaseFilesystemProvider
│   └── indexing/
│       ├── indexer.ts                # File indexing logic
│       └── hybrid-search.ts          # BM25 + vector combined search
│
├── skills/
│   ├── index.ts
│   ├── types.ts
│   ├── skill-service.ts              # CRUD operations
│   ├── skill-loader.ts               # Dynamic loading for agent context
│   └── generators/
│       ├── slack-skill-generator.ts
│       ├── github-skill-generator.ts
│       └── intercom-skill-generator.ts

app/src/mastra/tools/
├── workspace-tools.ts                # read_file, list_files, hybrid_search
└── skill-tools.ts                    # activate_skill, list_skills

app/src/app/api/projects/[id]/
├── workspace/
│   ├── route.ts                      # GET/POST workspace
│   └── search/route.ts               # POST hybrid search
└── skills/
    ├── route.ts                      # GET/POST skills
    └── [skillId]/route.ts            # GET/PUT/DELETE skill
```

---

## Core Implementation

### 1. SupabaseFilesystemProvider

Read-only filesystem provider that wraps Supabase Storage:

```typescript
export class SupabaseFilesystemProvider {
  constructor(
    private supabase: SupabaseClient,
    private options: { projectId: string; bucket: 'knowledge' | 'documents' }
  ) {}

  async read(path: string): Promise<{ content: string; error: Error | null }>
  async list(directory: string): Promise<{ files: FileInfo[]; error: Error | null }>
  async exists(path: string): Promise<boolean>
}
```

### 2. Workspace Manager

Handles workspace lifecycle and RuntimeContext injection:

```typescript
export class WorkspaceManager {
  async getOrCreateWorkspace(projectId: string, namedPackageId: string | null): Promise<WorkspaceContext>
  async injectIntoRuntimeContext(runtimeContext: RuntimeContext, projectId: string, namedPackageId: string | null): void
  clearCache(projectId?: string): void
}
```

### 3. Hybrid Search

Combines BM25 (keyword) with vector (semantic) search using RRF fusion:

```typescript
export async function hybridSearchWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  query: string,
  options: { limit?: number; vectorWeight?: number; bm25Weight?: number }
): Promise<HybridSearchResult[]>
```

### 4. Agent-Specific Workspace Access

Different agents get different workspace scopes:

| Agent | Knowledge | Codebase | Skills |
|-------|-----------|----------|--------|
| Support Agent | Read | **No** | Yes |
| PM Agent | Read | Read | No |
| Technical Analyst | Read | Read | No |
| Spec Writer | Read | Read | No |

Implementation in `workspace-manager.ts`:
```typescript
type AgentScope = 'support' | 'pm' | 'technical' | 'spec'

function getWorkspaceScopeForAgent(agent: AgentScope): WorkspaceScope {
  if (agent === 'support') {
    return { knowledge: true, codebase: false, skills: true }
  }
  return { knowledge: true, codebase: true, skills: false }
}
```

### 5. Skill Configuration (SKILL.md Standard)

Skills follow the SKILL.md frontmatter standard:

```yaml
---
name: Refund Policy Expert
version: 1.0.0
tags: [support, billing, refunds]
triggers:
  - keyword: refund
  - keyword: money back
  - keyword: cancel subscription
tools:
  - search-knowledge
  - get-knowledge-package
---

# Refund Policy Expert

You are an expert on refund policies. When users ask about refunds:
1. Check if they qualify based on our 30-day policy
2. Explain the refund process clearly
3. Offer alternatives if refund isn't applicable
```

Agent loads all enabled skills, evaluates triggers against user message, and includes matching skill instructions in context.

```typescript
interface SkillConfig {
  triggers: { keyword: string }[]  // Keyword-based activation
  tools: string[]                  // Tools available to skill
  instructions: string             // SKILL.md markdown content
  tags: string[]                   // Categorization
  version: string
  enabled: boolean
}
```

---

## Integration Points

### Widget Chat Stream Route

Modify `app/src/app/api/integrations/widget/chat/stream/route.ts`:

```typescript
// After line 89 (supabase = createAdminClient())
const workspaceManager = new WorkspaceManager(supabase)
await workspaceManager.injectIntoRuntimeContext(runtimeContext, projectId, namedPackageId)

// Load skills into context
const skills = await loadEnabledSkills(supabase, projectId)
runtimeContext.set('skills', skills)
```

### Knowledge Analysis Workflow

Modify `save-packages.ts` step to also update workspace index:

```typescript
// After saving packages to storage
await indexWorkspaceFiles(supabase, projectId, namedPackageId)
```

---

## Security Model

1. **Database RLS**: All new tables have project-based RLS policies
2. **Path Isolation**: SupabaseFilesystemProvider enforces `{project_id}/` prefix
3. **Skill Scoping**: Skills can only access workspaces within their project
4. **No Cross-Tenant Access**: Workspace tools validate projectId from RuntimeContext

---

## Phased Rollout

| Phase | Scope | Key Files |
|-------|-------|-----------|
| 1 | Database schema + migrations | `supabase/migrations/20260201_workspaces_and_skills.sql` |
| 2 | SupabaseFilesystemProvider + WorkspaceManager | `lib/workspace/providers/`, `lib/workspace/workspace-manager.ts` |
| 3 | Codebase snapshot persistence | `lib/workspace/codebase-snapshot-service.ts`, modify knowledge-analysis workflow |
| 4 | Workspace tools + per-agent scoping | `mastra/tools/workspace-tools.ts`, modify agent tool injection |
| 5 | Skill service (SKILL.md format) | `lib/skills/skill-service.ts`, `lib/skills/skill-loader.ts` |
| 6 | Integration skill generators | `lib/skills/generators/*.ts` |
| 7 | Hybrid search (BM25 + vector RRF) | `lib/workspace/indexing/hybrid-search.ts` |
| 8 | API routes (skills, workspace) | `app/api/projects/[id]/workspace/`, `app/api/projects/[id]/skills/` |

**Note**: UI for skill management is a follow-up phase (API-only first).

---

## Verification

1. **Unit Tests**: Filesystem provider path resolution, skill config validation
2. **Integration Tests**:
   - Workspace creation after knowledge analysis
   - Agent file access with correct project scoping
   - Skill execution with workspace context
3. **E2E Tests**:
   - Support agent answers using workspace search
   - Custom skill creation and activation
   - Cross-tenant isolation verification

---

## Decisions

1. **Codebase Access**: PM Agent can access codebase, Support Agent only accesses knowledge packages. Per-agent workspace scoping required.
2. **Skill Triggers**: Keyword matching via SKILL.md frontmatter. Agent loads frontmatter and decides based on context.
3. **UI Priority**: API-only first, UI in follow-up phase.
