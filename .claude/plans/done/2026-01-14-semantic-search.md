# Semantic Search for Knowledge Base

## Summary
Add pgvector-based semantic search to the knowledge system, enabling the support agent to find relevant content using natural language queries instead of keyword matching.

## Key Decisions
- **Embedding model**: OpenAI text-embedding-3-small (1536 dimensions)
- **Docs portal crawling**: Sitemap-first, then link crawling fallback
- **UI**: Simple search box with collapsible result snippets

---

## Implementation Steps

### Phase 1: Database Schema

**File**: `app/supabase/migrations/20260115000000_add_knowledge_embeddings.sql`

Create `knowledge_embeddings` table:
```sql
CREATE TABLE public.knowledge_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES knowledge_packages(id) ON DELETE CASCADE,
  category text NOT NULL,
  chunk_index integer NOT NULL,
  chunk_text text NOT NULL,
  section_heading text,
  parent_headings text[],
  embedding extensions.vector(1536) NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE (package_id, chunk_index, version)
);

-- HNSW index for fast similarity search
CREATE INDEX knowledge_embeddings_embedding_idx
  ON knowledge_embeddings USING hnsw (embedding extensions.vector_cosine_ops);

-- RLS policies (same pattern as knowledge_packages)
```

Add `search_knowledge_embeddings` RPC function for vector search.

---

### Phase 2: Chunking Service

**File**: `app/src/lib/knowledge/chunking.ts`

Markdown-aware chunking:
- **Chunk size**: ~2000 chars (512 tokens)
- **Overlap**: ~500 chars (128 tokens)
- **Split strategy**: Headings first, then paragraphs
- **Preserve context**: Track section heading and parent heading hierarchy

```typescript
export interface KnowledgeChunk {
  index: number
  text: string
  sectionHeading: string | null
  parentHeadings: string[]
}

export function chunkKnowledgeContent(content: string): KnowledgeChunk[]
```

---

### Phase 3: Embedding Service

**File**: `app/src/lib/knowledge/embedding-service.ts`

```typescript
// Generate embeddings for texts (batched)
async function generateEmbeddings(texts: string[]): Promise<number[][]>

// Embed all packages for a project
export async function embedProjectKnowledge(projectId: string): Promise<EmbeddingResult>

// Embed a query for search
export async function embedQuery(query: string): Promise<number[]>
```

Uses OpenAI SDK with `text-embedding-3-small` model.

---

### Phase 4: Workflow Integration

**File**: `app/src/mastra/workflows/knowledge-analysis/steps/embed-knowledge.ts`

Add Step 6 to workflow:
```typescript
export const embedKnowledge = createStep({
  id: 'embed-knowledge',
  description: 'Generate vector embeddings for semantic search',
  // Calls embedProjectKnowledge() after packages are saved
})
```

**Update**: `app/src/mastra/workflows/knowledge-analysis/index.ts`
```typescript
.then(saveKnowledgePackages)
.then(embedKnowledge)  // Add new step
```

---

### Phase 5: Semantic Search Tool

**File**: `app/src/mastra/tools/knowledge-tools.ts`

Add new tool alongside existing keyword search:

```typescript
export const semanticSearchKnowledgeTool = createTool({
  id: 'semantic-search-knowledge',
  description: 'Search knowledge using semantic similarity...',
  inputSchema: z.object({
    query: z.string(),
    categories: z.array(...).optional(),
    limit: z.number().default(5),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      category: z.string(),
      chunk: z.string(),
      sectionHeading: z.string().nullable(),
      similarity: z.number(),
    })),
  }),
  execute: async ({ context, runtimeContext }) => {
    // 1. Get projectId from runtimeContext
    // 2. Generate query embedding via embedQuery()
    // 3. Call search_knowledge_embeddings RPC
    // 4. Return ranked results
  },
})
```

Update `knowledgeTools` array to include new tool.

---

### Phase 6: Search API Endpoint

**File**: `app/src/app/api/projects/[id]/knowledge/search/route.ts`

```typescript
POST /api/projects/[id]/knowledge/search
Body: { query: string, categories?: string[], limit?: number }

// 1. Authenticate and authorize
// 2. Generate query embedding
// 3. Call search_knowledge_embeddings RPC
// 4. Return results with similarity scores
```

---

### Phase 7: Ask UI Component

**File**: `app/src/components/projects/project-detail/knowledge-ask-box.tsx`

```typescript
export function KnowledgeAskBox({ projectId }: { projectId: string }) {
  // Input field + "Ask" button
  // Calls POST /api/projects/[id]/knowledge/search
  // Displays results as collapsible cards with:
  //   - Category badge
  //   - Section heading
  //   - Content preview (expandable)
  //   - Similarity percentage
}
```

**Update**: `app/src/components/projects/project-detail/knowledge-management-card.tsx`

Add collapsible "Ask Knowledge Base" section after KnowledgeSection:
```tsx
{hasKnowledge && !isAnalyzing && (
  <Collapsible trigger="Ask Knowledge Base">
    <KnowledgeAskBox projectId={projectId} />
  </Collapsible>
)}
```

---

### Phase 8: Docs Portal Crawler

**File**: `app/src/lib/knowledge/docs-crawler.ts`

```typescript
export async function crawlDocsPortal(
  entryUrl: string,
  options?: { maxPages?: number; rateLimit?: number }
): Promise<CrawlResult[]>

// 1. Try fetching sitemap.xml (common locations)
// 2. Parse URLs from sitemap
// 3. If no sitemap, crawl internal links from entry page
// 4. Fetch each discovered page
// 5. Extract text content
// 6. Return array of { url, title, content }
```

**Update**: `app/src/mastra/workflows/knowledge-analysis/steps/analyze-sources.ts`

For `docs_portal` source type:
```typescript
case 'docs_portal': {
  const crawlResults = await crawlDocsPortal(source.url, { maxPages: 50 })
  // Combine all pages into structured content
  // Pass to agent for summarization
}
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `app/supabase/migrations/20260115000000_add_knowledge_embeddings.sql` | Database schema |
| `app/src/lib/knowledge/chunking.ts` | Markdown chunking logic |
| `app/src/lib/knowledge/embedding-service.ts` | OpenAI embedding generation |
| `app/src/lib/knowledge/docs-crawler.ts` | Sitemap + link crawler |
| `app/src/mastra/workflows/knowledge-analysis/steps/embed-knowledge.ts` | Workflow step |
| `app/src/app/api/projects/[id]/knowledge/search/route.ts` | Search API |
| `app/src/components/projects/project-detail/knowledge-ask-box.tsx` | Ask UI |

### Modified Files
| File | Changes |
|------|---------|
| `app/src/mastra/workflows/knowledge-analysis/index.ts` | Add embed step |
| `app/src/mastra/workflows/knowledge-analysis/steps/analyze-sources.ts` | Add crawler for docs_portal |
| `app/src/mastra/tools/knowledge-tools.ts` | Add semantic search tool |
| `app/src/mastra/agents/support-agent.ts` | Update instructions for semantic search |
| `app/src/components/projects/project-detail/knowledge-management-card.tsx` | Add Ask section |
| `app/src/lib/knowledge/types.ts` | Add embedding types |

---

## Verification

1. **Database**: Run `supabase db push` and verify table created
2. **Embedding**: Trigger knowledge analysis, check `knowledge_embeddings` populated
3. **Search API**: POST to `/api/projects/[id]/knowledge/search` with test query
4. **UI**: Open project detail, use "Ask Knowledge Base" search box
5. **Support Agent**: In widget, ask natural language question, verify semantic search used
6. **Docs Portal**: Add docs_portal source, run analysis, verify multiple pages indexed
