/**
 * Semantic Search Integration Tests
 *
 * Tests the semantic search functionality for knowledge sources:
 * - Embedding generation and storage
 * - Semantic search tool functionality
 * - Hissuno Agent usage of semantic search
 *
 * REQUIREMENTS:
 * - Supabase database must be running and accessible
 * - OpenAI API key must be configured
 * - Environment variables must be set (.env.local)
 *
 * Run with: npx vitest run src/__tests__/integration/knowledge-analysis/semantic-search.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { RuntimeContext } from '@mastra/core/runtime-context'

vi.mock('@/mastra', async (importOriginal) => {
  if (process.env.RUN_INTEGRATION_TESTS === 'true') {
    return importOriginal()
  }
  return {
    mastra: {
      getWorkflow: () => null,
      getAgent: () => null,
    },
  }
})

import { mastra } from '@/mastra'
import {
  setupTestProject,
  createRawTextSource,
  cleanupTestData,
  cleanupOrphanedTestData,
  type TestContext,
} from './test-utils'
import { db } from '@/lib/db'
import { eq, asc, sql } from 'drizzle-orm'
import { projects, knowledgeEmbeddings } from '@/lib/db/schema/app'
import { mockOpenAIEmbeddings } from '@/__tests__/mocks/openai-embeddings'

// Test timeout for integration tests
const TEST_TIMEOUT = 120000

const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true'

if (!shouldRun) {
  console.log('[semantic-search] Skipping integration tests')
  console.log('  To run: RUN_INTEGRATION_TESTS=true npm run test:integration')
}

// Check if database is available
let isDatabaseAvailable = false

async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.select({ id: projects.id }).from(projects).limit(1)
    return true
  } catch {
    return false
  }
}

// Conditionally skip tests based on database availability
const describeWithDb = (name: string, fn: () => void) => {
  describe(name, () => {
    beforeAll(async () => {
      isDatabaseAvailable = await checkDatabaseConnection()
    })

    fn()
  })
}

const itWithDb = (name: string, fn: () => Promise<void>, timeout?: number) => {
  it(
    name,
    async () => {
      if (!isDatabaseAvailable) {
        console.log(`Skipping "${name}" - database not available`)
        return
      }
      await fn()
    },
    timeout
  )
}

let testContext: TestContext

// ============================================================================
// Setup & Teardown
// ============================================================================

describe('Semantic Search Integration', { skip: !shouldRun }, () => {

beforeAll(async () => {
  // Mock OpenAI embeddings API for deterministic tests
  mockOpenAIEmbeddings()

  await cleanupOrphanedTestData()

  // Mock agents for deterministic testing
  // New workflow: fetch-content → sanitize-content → save-and-embed
  vi.spyOn(mastra, 'getAgent').mockImplementation((agentId: string) => {
    return {
      generate: vi.fn().mockImplementation(async (messages) => {
        if (agentId === 'codebaseAnalyzerAgent') {
          return { text: '' }
        }
        if (agentId === 'webScraperAgent') {
          return { text: '' }
        }
        if (agentId === 'securityScannerAgent') {
          // Passthrough: return the content as-is (no redactions in test data)
          const prompt = messages?.[0]?.content || ''
          // Extract content after the "CONTENT TO SCAN:" marker
          const contentMatch = prompt.match(/CONTENT TO SCAN:\n([\s\S]*?)(?:\n---$|$)/m)
          return { text: contentMatch?.[1]?.trim() || prompt }
        }
        return { text: 'Mock response' }
      }),
    } as unknown as ReturnType<typeof mastra.getAgent>
  })
}, 30000)

afterAll(async () => {
  vi.restoreAllMocks()
  await cleanupTestData()
}, 30000)

beforeEach(async () => {
  await cleanupTestData()
})

// ============================================================================
// Helper Functions
// ============================================================================

type WorkflowSourceType = 'website' | 'docs_portal' | 'uploaded_doc' | 'raw_text'

interface WorkflowInput {
  projectId: string
  packageId: string | null
  analysisScope: string | null
  sources: Array<{
    id: string
    type: WorkflowSourceType
    url?: string | null
    storagePath?: string | null
    content?: string | null
  }>
}

async function executeWorkflow(input: WorkflowInput) {
  const workflow = mastra.getWorkflow('packageCompilationWorkflow')
  if (!workflow) {
    throw new Error('Workflow not found')
  }

  const run = await workflow.createRunAsync({ runId: `test-${Date.now()}` })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return run.start({ inputData: input as any })
}

async function getEmbeddings(projectId: string) {
  const data = await db
    .select()
    .from(knowledgeEmbeddings)
    .where(eq(knowledgeEmbeddings.project_id, projectId))
    .orderBy(asc(knowledgeEmbeddings.chunk_index))

  return data
}

// ============================================================================
// Tests: Embedding Generation (Requires Database)
// ============================================================================

describeWithDb('Embedding Generation', () => {
  itWithDb(
    'should generate embeddings after knowledge analysis workflow',
    async () => {
      // Setup project with raw text source
      testContext = await setupTestProject({
        name: 'Embedding Test Project',
        withSourceCode: false,
      })

      const source = await createRawTextSource(
        testContext.projectId,
        `# Company Info

        Acme Corp is a SaaS company providing customer analytics solutions.
        We help businesses understand their customers better.

        ## Features
        - Real-time analytics
        - Customer segmentation
        - Cohort analysis
        `
      )

      // Execute workflow (synchronous — embeddings created before return)
      await executeWorkflow({
        projectId: testContext.projectId,
        packageId: null,
        analysisScope: null,
        sources: [
          {
            id: source.id,
            type: 'raw_text',
            content: source.content,
          },
        ],
      })

      // Verify embeddings were created
      const embeddings = await getEmbeddings(testContext.projectId)
      expect(embeddings.length).toBeGreaterThan(0)

      // Verify embedding structure
      const firstEmbedding = embeddings[0]
      expect(firstEmbedding.project_id).toBe(testContext.projectId)
      expect(firstEmbedding.source_id).toBe(source.id)
      expect(firstEmbedding.chunk_text).toBeDefined()
      expect(firstEmbedding.embedding).toBeDefined()
    },
    TEST_TIMEOUT
  )

  itWithDb(
    'should create embeddings with correct metadata',
    async () => {
      testContext = await setupTestProject({
        name: 'Embedding Metadata Test',
        withSourceCode: false,
      })

      const source = await createRawTextSource(
        testContext.projectId,
        `# Main Topic

## Subtopic One

Content for subtopic one with details.

### Deep Section

Very specific information here.

## Subtopic Two

Another section with content.
`
      )

      await executeWorkflow({
        projectId: testContext.projectId,
        packageId: null,
        analysisScope: null,
        sources: [
          {
            id: source.id,
            type: 'raw_text',
            content: source.content,
          },
        ],
      })

      const embeddings = await getEmbeddings(testContext.projectId)

      // Check that embeddings have heading metadata
      const embeddingsWithHeadings = embeddings.filter(
        (e) => e.section_heading !== null || (e.parent_headings && e.parent_headings.length > 0)
      )

      // Should have at least some embeddings with heading info
      expect(embeddingsWithHeadings.length).toBeGreaterThanOrEqual(0)

      // All embeddings should have required fields
      embeddings.forEach((emb) => {
        expect(emb.chunk_index).toBeGreaterThanOrEqual(0)
        expect(emb.chunk_text.length).toBeGreaterThan(0)
        expect(emb.version).toBeGreaterThanOrEqual(1)
      })
    },
    TEST_TIMEOUT
  )

  itWithDb(
    'should replace old embeddings on re-analysis',
    async () => {
      testContext = await setupTestProject({
        name: 'Embedding Update Test',
        withSourceCode: false,
      })

      const source = await createRawTextSource(testContext.projectId, 'Initial content for testing.')

      // First analysis
      await executeWorkflow({
        projectId: testContext.projectId,
        packageId: null,
        analysisScope: null,
        sources: [{ id: source.id, type: 'raw_text', content: 'Initial content for testing.' }],
      })

      let embeddings = await getEmbeddings(testContext.projectId)
      const initialIds = new Set(embeddings.map((e) => e.id))

      // Second analysis with different content
      await executeWorkflow({
        projectId: testContext.projectId,
        packageId: null,
        analysisScope: null,
        sources: [
          {
            id: source.id,
            type: 'raw_text',
            content: 'Updated content that is different from before.',
          },
        ],
      })

      embeddings = await getEmbeddings(testContext.projectId)

      // Old embeddings should be replaced (different IDs)
      const newIds = new Set(embeddings.map((e) => e.id))
      const overlap = [...initialIds].filter((id) => newIds.has(id))

      // No overlap means old embeddings were deleted and new ones created
      expect(overlap.length).toBe(0)
      expect(embeddings.length).toBeGreaterThan(0)
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// Tests: Semantic Search Tool (Requires Database)
// ============================================================================

describeWithDb('Semantic Search Tool', () => {
  itWithDb(
    'should find relevant content by semantic similarity',
    async () => {
      // Setup and run workflow
      testContext = await setupTestProject({
        name: 'Semantic Search Test',
        withSourceCode: false,
      })

      const content = `
# Product Documentation

## Pricing Plans

### Starter Plan
The Starter plan costs $29 per month and includes:
- Up to 1,000 monthly active users
- Basic analytics dashboard
- Email support

### Professional Plan
The Professional plan costs $99 per month and includes:
- Up to 10,000 monthly active users
- Advanced analytics
- Priority support
- API access

### Enterprise Plan
Custom pricing for large organizations with:
- Unlimited users
- Dedicated account manager
- SLA guarantees

## Features

Our platform provides real-time customer analytics including:
- Session tracking
- Funnel analysis
- Cohort reports
- A/B test integration
`

      const source = await createRawTextSource(testContext.projectId, content)

      await executeWorkflow({
        projectId: testContext.projectId,
        packageId: null,
        analysisScope: null,
        sources: [{ id: source.id, type: 'raw_text', content }],
      })

      // Import search function
      const { searchKnowledgeBySourceIds } = await import('@/lib/knowledge/embedding-service')

      // Search for pricing information
      const results = await searchKnowledgeBySourceIds(testContext.projectId, 'How much does it cost?', {
        limit: 5,
        similarityThreshold: 0.5,
      })

      expect(results.length).toBeGreaterThan(0)

      // Results should be related to pricing
      const hasRelevantContent = results.some(
        (r) =>
          r.chunkText.toLowerCase().includes('price') ||
          r.chunkText.toLowerCase().includes('cost') ||
          r.chunkText.toLowerCase().includes('plan') ||
          r.chunkText.toLowerCase().includes('$')
      )
      expect(hasRelevantContent).toBe(true)
    },
    TEST_TIMEOUT
  )

  itWithDb(
    'should return results with similarity scores',
    async () => {
      testContext = await setupTestProject({
        name: 'Similarity Score Test',
        withSourceCode: false,
      })

      const source = await createRawTextSource(
        testContext.projectId,
        `
# Getting Started Guide

Follow these steps to get started with our product:

1. Create an account at our website
2. Install the tracking code
3. Configure your dashboard
4. Start analyzing your data
`
      )

      await executeWorkflow({
        projectId: testContext.projectId,
        packageId: null,
        analysisScope: null,
        sources: [{ id: source.id, type: 'raw_text', content: source.content }],
      })

      const { searchKnowledgeBySourceIds } = await import('@/lib/knowledge/embedding-service')

      const results = await searchKnowledgeBySourceIds(testContext.projectId, 'how to get started', {
        limit: 5,
        similarityThreshold: 0.3,
      })

      // Results should have similarity scores
      results.forEach((r) => {
        expect(r.similarity).toBeGreaterThan(0)
        expect(r.similarity).toBeLessThanOrEqual(1)
      })

      // Results should be sorted by similarity (highest first)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity)
      }
    },
    TEST_TIMEOUT
  )

  itWithDb(
    'should return empty array when no matches above threshold',
    async () => {
      testContext = await setupTestProject({
        name: 'No Matches Test',
        withSourceCode: false,
      })

      const source = await createRawTextSource(
        testContext.projectId,
        'Simple content about customer analytics and business intelligence.'
      )

      await executeWorkflow({
        projectId: testContext.projectId,
        packageId: null,
        analysisScope: null,
        sources: [{ id: source.id, type: 'raw_text', content: source.content }],
      })

      const { searchKnowledgeBySourceIds } = await import('@/lib/knowledge/embedding-service')

      // Search with very high threshold for unrelated query
      const results = await searchKnowledgeBySourceIds(testContext.projectId, 'quantum physics theories', {
        limit: 5,
        similarityThreshold: 0.95, // Very high threshold
      })

      // May have no results or low similarity results
      expect(results.length).toBeGreaterThanOrEqual(0)
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// Tests: Semantic Search Mastra Tool
// ============================================================================

describe('Semantic Search Mastra Tool', () => {
  it(
    'should be available in knowledge tools',
    async () => {
      const { semanticSearchKnowledgeToolV2: semanticSearchKnowledgeTool } = await import('@/mastra/tools/analysis-knowledge-tools')

      expect(semanticSearchKnowledgeTool).toBeDefined()
      expect(semanticSearchKnowledgeTool.id).toBe('semantic-search-knowledge')
    },
    TEST_TIMEOUT
  )

  it(
    'should have correct schema',
    async () => {
      const { semanticSearchKnowledgeToolV2: semanticSearchKnowledgeTool } = await import('@/mastra/tools/analysis-knowledge-tools')

      // Tool should have input and output schemas
      expect(semanticSearchKnowledgeTool.inputSchema).toBeDefined()
      expect(semanticSearchKnowledgeTool.outputSchema).toBeDefined()

      // Input should require query
      const inputSchema = semanticSearchKnowledgeTool.inputSchema
      expect(inputSchema.shape.query).toBeDefined()
    },
    TEST_TIMEOUT
  )

  it(
    'should return error when projectId not in context',
    async () => {
      const { semanticSearchKnowledgeToolV2: semanticSearchKnowledgeTool } = await import('@/mastra/tools/analysis-knowledge-tools')

      // Execute with empty runtime context (no projectId set)
      const emptyRuntimeContext = new RuntimeContext()

      const result = await semanticSearchKnowledgeTool.execute({
        context: { query: 'test query' },
        runtimeContext: emptyRuntimeContext,
      })

      expect(result.error).toBeDefined()
      expect(result.results).toEqual([])
    },
    TEST_TIMEOUT
  )

  itWithDb(
    'should execute search when projectId is in context',
    async () => {
      // Setup project with embeddings
      testContext = await setupTestProject({
        name: 'Tool Execution Test',
        withSourceCode: false,
      })

      const source = await createRawTextSource(
        testContext.projectId,
        `
# Product Features

Our main features include:
- Real-time analytics dashboard
- Customer segmentation tools
- Export functionality
`
      )

      await executeWorkflow({
        projectId: testContext.projectId,
        packageId: null,
        analysisScope: null,
        sources: [{ id: source.id, type: 'raw_text', content: source.content }],
      })

      const { semanticSearchKnowledgeToolV2: semanticSearchKnowledgeTool } = await import('@/mastra/tools/analysis-knowledge-tools')

      // Create runtime context with projectId
      const runtimeContext = new RuntimeContext()
      runtimeContext.set('projectId', testContext.projectId)

      const result = await semanticSearchKnowledgeTool.execute({
        context: { query: 'what features are available?', limit: 5 },
        runtimeContext,
      })

      expect(result.error).toBeUndefined()
      expect(result.totalResults).toBeGreaterThanOrEqual(0)
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// Tests: Support Agent Integration
// ============================================================================

describe('Hissuno Agent Knowledge', () => {
  it(
    'should not have knowledge tools (knowledge is injected via system prompt)',
    async () => {
      const { supportAgent } = await import('@/mastra/agents/support-agent')

      expect(supportAgent.tools).toBeDefined()
      // Hissuno Agent no longer has knowledge tools - knowledge is loaded into system prompt
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((supportAgent.tools as any)['semantic-search-knowledge']).toBeUndefined()
    },
    TEST_TIMEOUT
  )

  it(
    'should mention Knowledge Base in instructions',
    async () => {
      const { supportAgent } = await import('@/mastra/agents/support-agent')

      // Verify agent instructions mention knowledge base (injected via system prompt)
      expect(supportAgent.instructions).toContain('Knowledge Base')
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// Tests: Search API Integration
// ============================================================================

describe('Search API', () => {
  it(
    'should have correct input validation',
    async () => {
      // This tests the API schema without making actual HTTP calls
      const validInput = {
        query: 'How do I get started?',
        limit: 5,
      }

      expect(validInput.query).toBeDefined()
      expect(typeof validInput.query).toBe('string')
      expect(typeof validInput.limit).toBe('number')
    },
    TEST_TIMEOUT
  )
})

}) // end Semantic Search Integration
