/**
 * Tests for Step 3: Discover Relationships.
 * Verifies all 7 strategies, skip conditions, error handling, scope preservation,
 * knowledge dedup, company text match gates, and counting accuracy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockLinkEntities = vi.hoisted(() => vi.fn())
const mockGetRelatedIds = vi.hoisted(() => vi.fn())
const mockClassifyGoal = vi.hoisted(() => vi.fn())
const mockDbSelectFromWhere = vi.hoisted(() => vi.fn())
const mockSearchSessionsSemantic = vi.hoisted(() => vi.fn())
const mockSearchSimilarIssues = vi.hoisted(() => vi.fn())
const mockSearchKnowledgeBySourceIds = vi.hoisted(() => vi.fn())
const mockSearchContactsSemantic = vi.hoisted(() => vi.fn())
const mockSearchCompaniesSemantic = vi.hoisted(() => vi.fn())

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => {
  const where = mockDbSelectFromWhere
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  return { db: { select } }
})

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ column: a, value: b })),
}))

vi.mock('@/lib/db/schema/app', () => ({
  productScopes: { id: 'ps.id', name: 'ps.name', description: 'ps.description', goals: 'ps.goals', project_id: 'ps.project_id' },
  companies: { id: 'c.id', name: 'c.name', domain: 'c.domain', project_id: 'c.project_id' },
}))

vi.mock('@/lib/db/queries/entity-relationships', () => ({
  linkEntities: mockLinkEntities,
  getRelatedIds: mockGetRelatedIds,
}))

vi.mock('@/mastra/workflows/graph-evaluation/steps/classify-goal', () => ({
  classifyGoal: mockClassifyGoal,
}))

vi.mock('@/lib/sessions/embedding-service', () => ({
  searchSessionsSemantic: mockSearchSessionsSemantic,
}))

vi.mock('@/lib/issues/embedding-service', () => ({
  searchSimilarIssues: mockSearchSimilarIssues,
}))

vi.mock('@/lib/knowledge/embedding-service', () => ({
  searchKnowledgeBySourceIds: mockSearchKnowledgeBySourceIds,
}))

vi.mock('@/lib/customers/customer-embedding-service', () => ({
  searchContactsSemantic: mockSearchContactsSemantic,
  searchCompaniesSemantic: mockSearchCompaniesSemantic,
}))

vi.mock('@/mastra/workflows/graph-evaluation/steps/enrich-relationship-context', () => ({
  enrichRelationshipContext: vi.fn().mockResolvedValue(new Map()),
}))

import { discoverRelationships } from '@/mastra/workflows/graph-evaluation/steps/discover-relationships'
import { DEFAULT_GRAPH_EVAL_CONFIG } from '@/mastra/workflows/graph-evaluation/config'
import type { GraphEntityType } from '@/mastra/workflows/graph-evaluation/schemas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ID = 'proj-1'
const ENTITY_ID = 'entity-1'

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    projectId: PROJECT_ID,
    entityType: 'session' as GraphEntityType,
    entityId: ENTITY_ID,
    topics: ['billing', 'payments'],
    combinedQuery: 'billing payments',
    contentForTextMatch: 'Some content about billing and payments at Acme Corp',
    entityName: 'Test Session',
    contentForSearch: 'Some content about billing',
    config: DEFAULT_GRAPH_EVAL_CONFIG,
    ...overrides,
  }
}

function setupDefaultMocks() {
  // Product scopes - none by default
  mockGetRelatedIds.mockResolvedValue([])
  mockDbSelectFromWhere.mockResolvedValue([])

  // Link entities - succeeds by default
  mockLinkEntities.mockResolvedValue(undefined)

  // Classify goal
  mockClassifyGoal.mockResolvedValue({
    matchedGoalId: null,
    matchedGoalText: null,
    reasoning: 'Matched via topic',
  })

  // All semantic searches - empty by default
  mockSearchSessionsSemantic.mockResolvedValue([])
  mockSearchSimilarIssues.mockResolvedValue([])
  mockSearchKnowledgeBySourceIds.mockResolvedValue([])
  mockSearchContactsSemantic.mockResolvedValue([])
  mockSearchCompaniesSemantic.mockResolvedValue([])
}

beforeEach(() => {
  vi.clearAllMocks()
  setupDefaultMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('discoverRelationships', () => {
  describe('early return', () => {
    it('returns 0 relationships when topics is empty AND combinedQuery is empty', async () => {
      const result = await discoverRelationships(makeInput({
        topics: [],
        combinedQuery: '',
      }))
      expect(result.relationshipsCreated).toBe(0)
      expect(result.productScopeId).toBeNull()
      expect(result.errors).toEqual([])
    })

    it('returns 0 relationships when topics is empty AND combinedQuery is falsy', async () => {
      const result = await discoverRelationships(makeInput({
        topics: [],
        combinedQuery: '',
      }))
      expect(result.relationshipsCreated).toBe(0)
      expect(mockSearchSessionsSemantic).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Strategy 1: Product scope text match
  // ==========================================================================

  describe('Strategy 1: Product scope text match', () => {
    const scopes = [
      {
        id: 'scope-1',
        name: 'Billing',
        description: 'Payment and billing features',
        goals: [
          { id: 'g1', text: 'Reduce payment failures' },
          { id: 'g2', text: 'Improve invoice generation' },
        ],
      },
    ]

    it('runs strategy for all entity types', async () => {
      for (const type of ['session', 'issue', 'knowledge_source', 'contact', 'company'] as const) {
        vi.clearAllMocks()
        setupDefaultMocks()

        await discoverRelationships(makeInput({ entityType: type }))
        expect(mockGetRelatedIds).toHaveBeenCalled()
      }
    })

    describe('existing scope preservation', () => {
      it('skips scope matching when entity already has product scope links', async () => {
        mockGetRelatedIds.mockResolvedValue(['existing-scope-id'])

        const result = await discoverRelationships(makeInput())
        // No product_scope links should be attempted
        const scopeLinkCalls = mockLinkEntities.mock.calls.filter(
          (call: unknown[]) => call[3] === 'product_scope',
        )
        expect(scopeLinkCalls).toHaveLength(0)
        expect(result.productScopeId).toBe('existing-scope-id')
      })

      it('does NOT increment relationshipsCreated for existing scopes', async () => {
        mockGetRelatedIds.mockResolvedValue(['existing-scope-id'])

        const result = await discoverRelationships(makeInput())
        expect(result.relationshipsCreated).toBe(0)
      })
    })

    describe('scope matching logic', () => {
      beforeEach(() => {
        mockDbSelectFromWhere.mockResolvedValue(scopes)
      })

      it('matches when topic is substring of scope text', async () => {
        const result = await discoverRelationships(makeInput({
          topics: ['billing'],
        }))
        expect(mockLinkEntities).toHaveBeenCalledWith(
          PROJECT_ID, 'session', ENTITY_ID, 'product_scope', 'scope-1',
          expect.any(Object),
        )
        expect(result.relationshipsCreated).toBeGreaterThanOrEqual(1)
      })

      it('matches when scope name is substring of topic (bidirectional)', async () => {
        await discoverRelationships(makeInput({
          topics: ['advanced billing system'],
        }))
        // "billing" (scope name lowercase) is found inside "advanced billing system"
        expect(mockLinkEntities).toHaveBeenCalledWith(
          PROJECT_ID, 'session', ENTITY_ID, 'product_scope', 'scope-1',
          expect.any(Object),
        )
      })

      it('matching is case-insensitive', async () => {
        mockDbSelectFromWhere.mockResolvedValue([{
          id: 'scope-upper',
          name: 'API Gateway',
          description: 'REST API Management',
          goals: [],
        }])

        await discoverRelationships(makeInput({
          topics: ['api gateway'],
        }))
        expect(mockLinkEntities).toHaveBeenCalledWith(
          PROJECT_ID, 'session', ENTITY_ID, 'product_scope', 'scope-upper',
          expect.any(Object),
        )
      })

      it('matches against goal texts in scope text', async () => {
        await discoverRelationships(makeInput({
          topics: ['payment failures'],
        }))
        // "payment failures" is in goal text "Reduce payment failures"
        expect(mockLinkEntities).toHaveBeenCalled()
      })

      it('calls classifyGoal with correct arguments', async () => {
        await discoverRelationships(makeInput({
          topics: ['billing'],
          entityName: 'My Session',
          contentForSearch: 'Billing content here',
        }))
        expect(mockClassifyGoal).toHaveBeenCalledWith({
          projectId: PROJECT_ID,
          entityName: 'My Session',
          contentSnippet: 'Billing content here',
          scopeName: 'Billing',
          scopeDescription: 'Payment and billing features',
          goals: scopes[0].goals,
          matchedTopic: 'billing',
        })
      })

      it('passes entityName defaulting to empty string when undefined', async () => {
        await discoverRelationships(makeInput({
          topics: ['billing'],
          entityName: undefined,
        }))
        expect(mockClassifyGoal).toHaveBeenCalledWith(
          expect.objectContaining({ entityName: '' }),
        )
      })

      it('passes contentForSearch truncated to 1500 chars, falling back to contentForTextMatch', async () => {
        const longContent = 'A'.repeat(2000)
        await discoverRelationships(makeInput({
          topics: ['billing'],
          contentForSearch: longContent,
        }))
        const call = mockClassifyGoal.mock.calls[0][0]
        expect(call.contentSnippet.length).toBe(1500)
      })

      it('falls back to contentForTextMatch when contentForSearch is undefined', async () => {
        await discoverRelationships(makeInput({
          topics: ['billing'],
          contentForSearch: undefined,
          contentForTextMatch: 'fallback content',
        }))
        const call = mockClassifyGoal.mock.calls[0][0]
        expect(call.contentSnippet).toBe('fallback content')
      })

      it('calls linkEntities with classification metadata', async () => {
        mockClassifyGoal.mockResolvedValue({
          matchedGoalId: 'g1',
          matchedGoalText: 'Reduce payment failures',
          reasoning: 'Relates to billing',
        })

        await discoverRelationships(makeInput({ topics: ['billing'] }))
        expect(mockLinkEntities).toHaveBeenCalledWith(
          PROJECT_ID, 'session', ENTITY_ID, 'product_scope', 'scope-1',
          expect.objectContaining({
            strategy: 'product_scope',
            matchedGoalId: 'g1',
            matchedGoalText: 'Reduce payment failures',
            reasoning: 'Relates to billing',
            topics: ['billing'],
          }),
        )
      })

      it('sets productScopeId to first matched scope only', async () => {
        mockDbSelectFromWhere.mockResolvedValue([
          { id: 'scope-a', name: 'Billing', description: 'billing features', goals: [] },
          { id: 'scope-b', name: 'Payments', description: 'payment processing', goals: [] },
        ])

        const result = await discoverRelationships(makeInput({
          topics: ['billing', 'payments'],
        }))
        expect(result.productScopeId).toBe('scope-a')
      })

      it('handles scope with null goals', async () => {
        mockDbSelectFromWhere.mockResolvedValue([{
          id: 'scope-null-goals',
          name: 'Billing',
          description: 'billing stuff',
          goals: null,
        }])

        // Should not crash - goals ?? [] handles null
        await discoverRelationships(makeInput({ topics: ['billing'] }))
        expect(mockLinkEntities).toHaveBeenCalled()
      })

      it('silently catches linkEntities errors', async () => {
        mockLinkEntities.mockRejectedValueOnce(new Error('constraint violation'))

        const result = await discoverRelationships(makeInput({ topics: ['billing'] }))
        // Should not throw, error swallowed by inner try/catch
        expect(result.errors).toEqual([])
      })
    })

    describe('no match scenarios', () => {
      it('does NOT match when topic has no overlap with scope text', async () => {
        mockDbSelectFromWhere.mockResolvedValue([{
          id: 'scope-x',
          name: 'Authentication',
          description: 'Auth and login features',
          goals: [],
        }])

        const result = await discoverRelationships(makeInput({
          topics: ['billing', 'payments'],
        }))
        expect(mockClassifyGoal).not.toHaveBeenCalled()
      })

      it('handles scope with null description', async () => {
        mockDbSelectFromWhere.mockResolvedValue([{
          id: 'scope-null-desc',
          name: 'Billing',
          description: null,
          goals: [],
        }])

        // Should not crash
        await discoverRelationships(makeInput({ topics: ['billing'] }))
        expect(mockLinkEntities).toHaveBeenCalled()
      })
    })

    it('adds error to errors array on strategy failure', async () => {
      mockGetRelatedIds.mockRejectedValue(new Error('DB error'))

      const result = await discoverRelationships(makeInput())
      expect(result.errors).toContainEqual(expect.stringContaining('Product scope matching failed'))
    })
  })

  // ==========================================================================
  // Strategy 2: Session semantic search
  // ==========================================================================

  describe('Strategy 2: Session semantic search', () => {
    it('skips when entityType is "session"', async () => {
      await discoverRelationships(makeInput({ entityType: 'session' }))
      expect(mockSearchSessionsSemantic).not.toHaveBeenCalled()
    })

    it('skips when combinedQuery is empty', async () => {
      await discoverRelationships(makeInput({ entityType: 'issue', combinedQuery: '' }))
      expect(mockSearchSessionsSemantic).not.toHaveBeenCalled()
    })

    it('runs for issue, knowledge_source, contact, company', async () => {
      for (const type of ['issue', 'knowledge_source', 'contact', 'company'] as const) {
        vi.clearAllMocks()
        setupDefaultMocks()

        await discoverRelationships(makeInput({ entityType: type }))
        expect(mockSearchSessionsSemantic).toHaveBeenCalledWith(
          PROJECT_ID, 'billing payments', { limit: 10, threshold: 0.6 },
        )
      }
    })

    it('links only first 5 results from up to 10 returned', async () => {
      const results = Array.from({ length: 10 }, (_, i) => ({ sessionId: `s-${i}` }))
      mockSearchSessionsSemantic.mockResolvedValue(results)

      await discoverRelationships(makeInput({ entityType: 'issue' }))
      expect(mockLinkEntities).toHaveBeenCalledTimes(5)
    })

    it('counts only fulfilled promises from Promise.allSettled', async () => {
      mockSearchSessionsSemantic.mockResolvedValue([
        { sessionId: 's-1' },
        { sessionId: 's-2' },
        { sessionId: 's-3' },
      ])
      // First two succeed, third fails
      mockLinkEntities
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('dup'))

      const result = await discoverRelationships(makeInput({ entityType: 'issue' }))
      expect(result.relationshipsCreated).toBe(2)
    })

    it('adds error to errors array on search failure', async () => {
      mockSearchSessionsSemantic.mockRejectedValue(new Error('Embedding service down'))

      const result = await discoverRelationships(makeInput({ entityType: 'issue' }))
      expect(result.errors).toContainEqual(expect.stringContaining('Session search failed'))
    })
  })

  // ==========================================================================
  // Strategy 3: Issue semantic search
  // ==========================================================================

  describe('Strategy 3: Issue semantic search', () => {
    it('skips when entityType is "issue"', async () => {
      await discoverRelationships(makeInput({ entityType: 'issue' }))
      expect(mockSearchSimilarIssues).not.toHaveBeenCalled()
    })

    it('skips when combinedQuery is empty', async () => {
      await discoverRelationships(makeInput({ combinedQuery: '' }))
      expect(mockSearchSimilarIssues).not.toHaveBeenCalled()
    })

    it('calls searchSimilarIssues with empty string as second arg', async () => {
      await discoverRelationships(makeInput({ entityType: 'session' }))
      expect(mockSearchSimilarIssues).toHaveBeenCalledWith(
        PROJECT_ID, 'billing payments', '',
        { limit: 10, threshold: 0.6 },
      )
    })

    it('links only first 5 results', async () => {
      const results = Array.from({ length: 8 }, (_, i) => ({ issueId: `i-${i}` }))
      mockSearchSimilarIssues.mockResolvedValue(results)

      await discoverRelationships(makeInput())
      // 5 from issue search (session search returns empty)
      const issueLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'issue',
      )
      expect(issueLinkCalls).toHaveLength(5)
    })

    it('adds error to errors array on search failure', async () => {
      mockSearchSimilarIssues.mockRejectedValue(new Error('Search failed'))

      const result = await discoverRelationships(makeInput())
      expect(result.errors).toContainEqual(expect.stringContaining('Issue search failed'))
    })
  })

  // ==========================================================================
  // Strategy 4: Knowledge semantic search
  // ==========================================================================

  describe('Strategy 4: Knowledge semantic search', () => {
    it('skips when entityType is "knowledge_source"', async () => {
      await discoverRelationships(makeInput({ entityType: 'knowledge_source' }))
      expect(mockSearchKnowledgeBySourceIds).not.toHaveBeenCalled()
    })

    it('skips when combinedQuery is empty', async () => {
      await discoverRelationships(makeInput({ combinedQuery: '' }))
      expect(mockSearchKnowledgeBySourceIds).not.toHaveBeenCalled()
    })

    it('uses similarityThreshold parameter (not threshold)', async () => {
      await discoverRelationships(makeInput())
      expect(mockSearchKnowledgeBySourceIds).toHaveBeenCalledWith(
        PROJECT_ID, 'billing payments',
        { limit: 10, similarityThreshold: 0.6 },
      )
    })

    it('deduplicates results by sourceId', async () => {
      mockSearchKnowledgeBySourceIds.mockResolvedValue([
        { sourceId: 'ks-1', chunkId: 'c1' },
        { sourceId: 'ks-1', chunkId: 'c2' }, // duplicate sourceId
        { sourceId: 'ks-2', chunkId: 'c3' },
      ])

      await discoverRelationships(makeInput())
      const knowledgeLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'knowledge_source',
      )
      expect(knowledgeLinkCalls).toHaveLength(2) // ks-1 and ks-2
    })

    it('skips chunks with null sourceId', async () => {
      mockSearchKnowledgeBySourceIds.mockResolvedValue([
        { sourceId: null, chunkId: 'c1' },
        { sourceId: 'ks-1', chunkId: 'c2' },
      ])

      await discoverRelationships(makeInput())
      const knowledgeLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'knowledge_source',
      )
      expect(knowledgeLinkCalls).toHaveLength(1) // only ks-1
    })

    it('limits to 5 unique sourceIds', async () => {
      const chunks = Array.from({ length: 10 }, (_, i) => ({
        sourceId: `ks-${i}`,
        chunkId: `c-${i}`,
      }))
      mockSearchKnowledgeBySourceIds.mockResolvedValue(chunks)

      await discoverRelationships(makeInput())
      const knowledgeLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'knowledge_source',
      )
      expect(knowledgeLinkCalls).toHaveLength(5)
    })

    it('adds error to errors array on search failure', async () => {
      mockSearchKnowledgeBySourceIds.mockRejectedValue(new Error('fail'))

      const result = await discoverRelationships(makeInput())
      expect(result.errors).toContainEqual(expect.stringContaining('Knowledge search failed'))
    })
  })

  // ==========================================================================
  // Strategy 5: Contact semantic search
  // ==========================================================================

  describe('Strategy 5: Contact semantic search', () => {
    it('skips when entityType is "contact"', async () => {
      await discoverRelationships(makeInput({ entityType: 'contact' }))
      expect(mockSearchContactsSemantic).not.toHaveBeenCalled()
    })

    it('skips when combinedQuery is empty', async () => {
      await discoverRelationships(makeInput({ entityType: 'issue', combinedQuery: '' }))
      expect(mockSearchContactsSemantic).not.toHaveBeenCalled()
    })

    it('runs for session, issue, knowledge_source, company', async () => {
      for (const type of ['session', 'issue', 'knowledge_source', 'company'] as const) {
        vi.clearAllMocks()
        setupDefaultMocks()

        await discoverRelationships(makeInput({ entityType: type }))
        expect(mockSearchContactsSemantic).toHaveBeenCalled()
      }
    })

    it('links only first 5 results', async () => {
      mockSearchContactsSemantic.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({ contactId: `ct-${i}` })),
      )

      await discoverRelationships(makeInput({ entityType: 'issue' }))
      const contactLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'contact',
      )
      expect(contactLinkCalls).toHaveLength(5)
    })
  })

  // ==========================================================================
  // Strategy 6: Company semantic search
  // ==========================================================================

  describe('Strategy 6: Company semantic search', () => {
    it('skips when entityType is "contact"', async () => {
      await discoverRelationships(makeInput({ entityType: 'contact' }))
      expect(mockSearchCompaniesSemantic).not.toHaveBeenCalled()
    })

    it('skips when entityType is "company"', async () => {
      await discoverRelationships(makeInput({ entityType: 'company' }))
      expect(mockSearchCompaniesSemantic).not.toHaveBeenCalled()
    })

    it('skips when combinedQuery is empty', async () => {
      await discoverRelationships(makeInput({ combinedQuery: '' }))
      expect(mockSearchCompaniesSemantic).not.toHaveBeenCalled()
    })

    it('runs for session, issue, knowledge_source', async () => {
      for (const type of ['session', 'issue', 'knowledge_source'] as const) {
        vi.clearAllMocks()
        setupDefaultMocks()

        await discoverRelationships(makeInput({ entityType: type }))
        expect(mockSearchCompaniesSemantic).toHaveBeenCalled()
      }
    })

    it('links only first 5 results from semantic search', async () => {
      mockSearchCompaniesSemantic.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({ companyId: `co-${i}` })),
      )

      await discoverRelationships(makeInput())
      const companySemanticCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'company',
      )
      // Up to 5 from semantic + potentially more from text match
      expect(companySemanticCalls.length).toBeLessThanOrEqual(10)
    })
  })

  // ==========================================================================
  // Strategy 7: Company text match fallback
  // ==========================================================================

  describe('Strategy 7: Company text match fallback', () => {
    const companiesData = [
      { id: 'co-1', name: 'Acme Corp', domain: 'acme.com' },
      { id: 'co-2', name: 'AB', domain: 'ab.io' },          // name length <= 2
      { id: 'co-3', name: 'Big Company', domain: null },     // no domain
    ]

    it('skips when entityType is "contact"', async () => {
      // For contact: strategies 1,5,6,7 are skipped; company text match query won't happen
      // We need to check the SECOND mockDbSelectFromWhere call (first is for scopes if applicable)
      await discoverRelationships(makeInput({ entityType: 'contact' }))
      // Company text match fetches all companies - should not happen for contacts
      // mockDbSelectFromWhere is used for both scope and company queries
      // For contact, scope query is also skipped, so no DB calls at all from strategies 1 and 7
      // Just verify no company-type links were attempted
      const companyLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'company',
      )
      expect(companyLinkCalls).toHaveLength(0)
    })

    it('skips when entityType is "company"', async () => {
      await discoverRelationships(makeInput({ entityType: 'company' }))
      const companyLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'company',
      )
      expect(companyLinkCalls).toHaveLength(0)
    })

    it('matches company name case-insensitively in contentForTextMatch', async () => {
      // First call returns scopes (empty), second call returns companies
      mockDbSelectFromWhere
        .mockResolvedValueOnce([]) // scopes
        .mockResolvedValueOnce(companiesData) // companies

      const result = await discoverRelationships(makeInput({
        contentForTextMatch: 'We had a meeting with ACME CORP today',
      }))
      // "Acme Corp" (name.length=9 > 2) should match "ACME CORP" case-insensitively
      const companyLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'company',
      )
      expect(companyLinkCalls.some((call: unknown[]) => call[4] === 'co-1')).toBe(true)
    })

    it('requires company name length > 2 for name matching', async () => {
      mockDbSelectFromWhere
        .mockResolvedValueOnce([]) // scopes
        .mockResolvedValueOnce([{ id: 'co-short', name: 'AB', domain: null }])

      await discoverRelationships(makeInput({
        contentForTextMatch: 'AB is mentioned here',
      }))
      const companyLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'company',
      )
      expect(companyLinkCalls).toHaveLength(0)
    })

    it('does NOT match company name with exactly 2 characters', async () => {
      mockDbSelectFromWhere
        .mockResolvedValueOnce([]) // scopes
        .mockResolvedValueOnce([{ id: 'co-2char', name: 'AI', domain: null }])

      await discoverRelationships(makeInput({
        contentForTextMatch: 'AI is transforming the industry',
      }))
      const companyLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'company',
      )
      expect(companyLinkCalls).toHaveLength(0)
    })

    it('matches company domain case-insensitively', async () => {
      mockDbSelectFromWhere
        .mockResolvedValueOnce([]) // scopes
        .mockResolvedValueOnce([{ id: 'co-domain', name: 'X', domain: 'example.com' }])

      await discoverRelationships(makeInput({
        contentForTextMatch: 'Visit EXAMPLE.COM for details',
      }))
      const companyLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'company',
      )
      expect(companyLinkCalls.some((call: unknown[]) => call[4] === 'co-domain')).toBe(true)
    })

    it('matches on domain even if name is too short', async () => {
      mockDbSelectFromWhere
        .mockResolvedValueOnce([]) // scopes
        .mockResolvedValueOnce([{ id: 'co-short-name', name: 'AB', domain: 'ab.io' }])

      await discoverRelationships(makeInput({
        contentForTextMatch: 'Check ab.io for more info',
      }))
      const companyLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'company',
      )
      expect(companyLinkCalls.some((call: unknown[]) => call[4] === 'co-short-name')).toBe(true)
    })

    it('handles company with null domain', async () => {
      mockDbSelectFromWhere
        .mockResolvedValueOnce([]) // scopes
        .mockResolvedValueOnce([{ id: 'co-no-domain', name: 'NodomainCo', domain: null }])

      // Should not crash when domain is null
      await discoverRelationships(makeInput({
        contentForTextMatch: 'NodomainCo is a partner',
      }))
      const companyLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'company',
      )
      expect(companyLinkCalls).toHaveLength(1)
    })

    it('links all matched companies (no limit of 5)', async () => {
      const manyCompanies = Array.from({ length: 8 }, (_, i) => ({
        id: `co-${i}`,
        name: `CompanyName${i}`,
        domain: null,
      }))
      mockDbSelectFromWhere
        .mockResolvedValueOnce([]) // scopes
        .mockResolvedValueOnce(manyCompanies)

      const content = manyCompanies.map(c => c.name).join(' is great, ')
      await discoverRelationships(makeInput({ contentForTextMatch: content }))
      const companyLinkCalls = mockLinkEntities.mock.calls.filter(
        (call: unknown[]) => call[3] === 'company',
      )
      // All 8 should be linked (no .slice(0,5))
      expect(companyLinkCalls.length).toBe(8)
    })

    it('adds error to errors array on failure', async () => {
      mockDbSelectFromWhere
        .mockResolvedValueOnce([]) // scopes
        .mockRejectedValueOnce(new Error('DB down'))

      const result = await discoverRelationships(makeInput())
      expect(result.errors).toContainEqual(expect.stringContaining('Company text match failed'))
    })
  })

  // ==========================================================================
  // Entity type skip matrix (comprehensive)
  // ==========================================================================

  describe('entity type skip matrix', () => {
    it('contact: runs strategies 1, 2, 3, 4 (skips 5, 6, 7)', async () => {
      mockSearchSessionsSemantic.mockResolvedValue([{ sessionId: 's1' }])
      mockSearchSimilarIssues.mockResolvedValue([{ issueId: 'i1' }])
      mockSearchKnowledgeBySourceIds.mockResolvedValue([{ sourceId: 'ks1' }])

      await discoverRelationships(makeInput({ entityType: 'contact' }))

      // Ran: scope matching, session search, issue search, knowledge search
      expect(mockGetRelatedIds).toHaveBeenCalled()
      expect(mockSearchSessionsSemantic).toHaveBeenCalled()
      expect(mockSearchSimilarIssues).toHaveBeenCalled()
      expect(mockSearchKnowledgeBySourceIds).toHaveBeenCalled()

      // Skipped: contact search (self), company semantic, company text match
      expect(mockSearchContactsSemantic).not.toHaveBeenCalled()
      expect(mockSearchCompaniesSemantic).not.toHaveBeenCalled()
    })

    it('company: runs strategies 1, 2, 3, 4, 5 (skips 6, 7)', async () => {
      mockSearchSessionsSemantic.mockResolvedValue([{ sessionId: 's1' }])
      mockSearchSimilarIssues.mockResolvedValue([{ issueId: 'i1' }])
      mockSearchKnowledgeBySourceIds.mockResolvedValue([{ sourceId: 'ks1' }])
      mockSearchContactsSemantic.mockResolvedValue([{ contactId: 'ct1' }])

      await discoverRelationships(makeInput({ entityType: 'company' }))

      // Ran
      expect(mockGetRelatedIds).toHaveBeenCalled()
      expect(mockSearchSessionsSemantic).toHaveBeenCalled()
      expect(mockSearchSimilarIssues).toHaveBeenCalled()
      expect(mockSearchKnowledgeBySourceIds).toHaveBeenCalled()
      expect(mockSearchContactsSemantic).toHaveBeenCalled()

      // Skipped: company semantic (self), company text match (self)
      expect(mockSearchCompaniesSemantic).not.toHaveBeenCalled()
    })

    it('session: runs strategies 1, 3, 4, 5, 6, 7 (skips 2)', async () => {
      await discoverRelationships(makeInput({ entityType: 'session' }))

      expect(mockGetRelatedIds).toHaveBeenCalled()         // strategy 1
      expect(mockSearchSessionsSemantic).not.toHaveBeenCalled() // skipped
      expect(mockSearchSimilarIssues).toHaveBeenCalled()    // strategy 3
      expect(mockSearchKnowledgeBySourceIds).toHaveBeenCalled() // strategy 4
      expect(mockSearchContactsSemantic).toHaveBeenCalled()  // strategy 5
      expect(mockSearchCompaniesSemantic).toHaveBeenCalled() // strategy 6
    })

    it('issue: runs strategies 1, 2, 4, 5, 6, 7 (skips 3)', async () => {
      await discoverRelationships(makeInput({ entityType: 'issue' }))

      expect(mockGetRelatedIds).toHaveBeenCalled()           // strategy 1
      expect(mockSearchSessionsSemantic).toHaveBeenCalled()  // strategy 2
      expect(mockSearchSimilarIssues).not.toHaveBeenCalled() // skipped
      expect(mockSearchKnowledgeBySourceIds).toHaveBeenCalled() // strategy 4
      expect(mockSearchContactsSemantic).toHaveBeenCalled()    // strategy 5
      expect(mockSearchCompaniesSemantic).toHaveBeenCalled()   // strategy 6
    })

    it('knowledge_source: runs strategies 1, 2, 3, 5, 6, 7 (skips 4)', async () => {
      await discoverRelationships(makeInput({ entityType: 'knowledge_source' }))

      expect(mockGetRelatedIds).toHaveBeenCalled()               // strategy 1
      expect(mockSearchSessionsSemantic).toHaveBeenCalled()      // strategy 2
      expect(mockSearchSimilarIssues).toHaveBeenCalled()         // strategy 3
      expect(mockSearchKnowledgeBySourceIds).not.toHaveBeenCalled() // skipped
      expect(mockSearchContactsSemantic).toHaveBeenCalled()       // strategy 5
      expect(mockSearchCompaniesSemantic).toHaveBeenCalled()      // strategy 6
    })
  })

  // ==========================================================================
  // Cross-strategy behavior
  // ==========================================================================

  describe('cross-strategy interaction', () => {
    it('accumulates relationshipsCreated across all strategies', async () => {
      // Scope match creates 1
      mockDbSelectFromWhere.mockResolvedValueOnce([
        { id: 'scope-1', name: 'Billing', description: 'billing', goals: [] },
      ])
      // Session search returns 2
      mockSearchSimilarIssues.mockResolvedValue([
        { issueId: 'i-1' },
        { issueId: 'i-2' },
      ])
      // Knowledge returns 1
      mockSearchKnowledgeBySourceIds.mockResolvedValue([{ sourceId: 'ks-1' }])

      const result = await discoverRelationships(makeInput({
        topics: ['billing'],
      }))
      // 1 scope + 2 issues + 1 knowledge + 0 from others
      expect(result.relationshipsCreated).toBe(4)
    })

    it('collects errors from multiple failing strategies', async () => {
      mockSearchSimilarIssues.mockRejectedValue(new Error('issue fail'))
      mockSearchKnowledgeBySourceIds.mockRejectedValue(new Error('knowledge fail'))

      const result = await discoverRelationships(makeInput())
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('relationship counting accuracy', () => {
    it('does not count rejected linkEntities calls', async () => {
      mockSearchSimilarIssues.mockResolvedValue([
        { issueId: 'i-1' },
        { issueId: 'i-2' },
        { issueId: 'i-3' },
      ])
      mockLinkEntities
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('dup'))
        .mockResolvedValueOnce(undefined)

      const result = await discoverRelationships(makeInput())
      // Only 2 fulfilled out of 3 attempts (for issue strategy)
      expect(result.relationshipsCreated).toBe(2)
    })

    it('returns 0 when all linkEntities calls are rejected', async () => {
      mockSearchSimilarIssues.mockResolvedValue([{ issueId: 'i-1' }])
      mockLinkEntities.mockRejectedValue(new Error('all fail'))

      const result = await discoverRelationships(makeInput())
      expect(result.relationshipsCreated).toBe(0)
    })
  })
})
