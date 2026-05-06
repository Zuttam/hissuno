/**
 * Tests for the graph evaluation pipeline orchestrator.
 * Verifies data flow between steps, early returns, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLoadEntityContent = vi.hoisted(() => vi.fn())
const mockExtractTopics = vi.hoisted(() => vi.fn())
const mockDiscoverRelationships = vi.hoisted(() => vi.fn())
const mockGetGraphEvaluationSettingsAdmin = vi.hoisted(() => vi.fn())

vi.mock('@/mastra/workflows/graph-evaluation/steps/load-entity-content', () => ({
  loadEntityContent: mockLoadEntityContent,
}))
vi.mock('@/mastra/workflows/graph-evaluation/steps/extract-topics', () => ({
  extractTopics: mockExtractTopics,
}))
vi.mock('@/mastra/workflows/graph-evaluation/steps/discover-relationships', () => ({
  discoverRelationships: mockDiscoverRelationships,
}))
vi.mock('@/lib/db/queries/graph-evaluation-settings', async () => {
  const actual = await vi.importActual<typeof import('@/mastra/workflows/graph-evaluation/config')>(
    '@/mastra/workflows/graph-evaluation/config',
  )
  return {
    getGraphEvaluationSettingsAdmin: mockGetGraphEvaluationSettingsAdmin,
    DEFAULT_GRAPH_EVAL_CONFIG: actual.DEFAULT_GRAPH_EVAL_CONFIG,
    parseGraphEvalConfig: actual.parseGraphEvalConfig,
  }
})

import { evaluateEntityRelationships } from '@/mastra/workflows/graph-evaluation'

const PROJECT_ID = 'proj-1'
const ENTITY_ID = 'entity-1'

beforeEach(async () => {
  vi.clearAllMocks()
  const { DEFAULT_GRAPH_EVAL_CONFIG } = await import('@/mastra/workflows/graph-evaluation/config')
  mockGetGraphEvaluationSettingsAdmin.mockResolvedValue(DEFAULT_GRAPH_EVAL_CONFIG)
})

describe('evaluateEntityRelationships', () => {
  describe('happy path', () => {
    const contentResult = {
      contentForSearch: 'search content',
      contentForTextMatch: 'text match content',
      entityName: 'Test Entity',
      guidelines: 'some guidelines',
    }
    const topicsResult = {
      topics: ['billing', 'payments'],
      combinedQuery: 'billing payments',
    }
    const discoveryResult = {
      relationshipsCreated: 3,
      productScopeId: 'scope-1',
      errors: [],
    }

    beforeEach(() => {
      mockLoadEntityContent.mockResolvedValue(contentResult)
      mockExtractTopics.mockResolvedValue(topicsResult)
      mockDiscoverRelationships.mockResolvedValue(discoveryResult)
    })

    it('calls loadEntityContent with projectId, entityType, entityId', async () => {
      await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(mockLoadEntityContent).toHaveBeenCalledWith(PROJECT_ID, 'session', ENTITY_ID)
    })

    it('calls extractTopics with contentForSearch, entityName, entityType, guidelines, projectId', async () => {
      await evaluateEntityRelationships(PROJECT_ID, 'issue', ENTITY_ID)
      expect(mockExtractTopics).toHaveBeenCalledWith(
        'search content',
        'Test Entity',
        'issue',
        'some guidelines',
        PROJECT_ID,
      )
    })

    it('calls discoverRelationships with correct input shape', async () => {
      await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(mockDiscoverRelationships).toHaveBeenCalledWith(expect.objectContaining({
        projectId: PROJECT_ID,
        entityType: 'session',
        entityId: ENTITY_ID,
        topics: ['billing', 'payments'],
        combinedQuery: 'billing payments',
        contentForTextMatch: 'text match content',
        entityName: 'Test Entity',
        contentForSearch: 'search content',
      }))
      expect(mockDiscoverRelationships.mock.calls[0][0].config).toBeDefined()
    })

    it('returns combined output with identity fields and discovery results', async () => {
      const result = await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(result).toEqual({
        projectId: PROJECT_ID,
        entityType: 'session',
        entityId: ENTITY_ID,
        relationshipsCreated: 3,
        productScopeId: 'scope-1',
        errors: [],
        createdContactId: null,
        createdIssueIds: [],
        issueResults: [],
        pmAction: null,
        pmSkipReason: null,
      })
    })
  })

  describe('empty content early return', () => {
    it('returns 0 relationships when both contentForSearch and contentForTextMatch are empty', async () => {
      mockLoadEntityContent.mockResolvedValue({
        contentForSearch: '',
        contentForTextMatch: '',
        entityName: 'Test',
        guidelines: null,
      })

      const result = await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(result.relationshipsCreated).toBe(0)
      expect(result.productScopeId).toBeNull()
      expect(result.errors).toEqual([])
    })

    it('does NOT call extractTopics when content is empty', async () => {
      mockLoadEntityContent.mockResolvedValue({
        contentForSearch: '',
        contentForTextMatch: '',
        entityName: 'Test',
        guidelines: null,
      })

      await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(mockExtractTopics).not.toHaveBeenCalled()
      expect(mockDiscoverRelationships).not.toHaveBeenCalled()
    })

    it('proceeds when contentForSearch is empty but contentForTextMatch has content', async () => {
      mockLoadEntityContent.mockResolvedValue({
        contentForSearch: '',
        contentForTextMatch: 'some text match content',
        entityName: 'Test',
        guidelines: null,
      })
      mockExtractTopics.mockResolvedValue({ topics: ['test'], combinedQuery: 'test' })
      mockDiscoverRelationships.mockResolvedValue({ relationshipsCreated: 1, productScopeId: null, errors: [] })

      await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(mockExtractTopics).toHaveBeenCalled()
    })

    it('proceeds when contentForTextMatch is empty but contentForSearch has content', async () => {
      mockLoadEntityContent.mockResolvedValue({
        contentForSearch: 'some search content',
        contentForTextMatch: '',
        entityName: 'Test',
        guidelines: null,
      })
      mockExtractTopics.mockResolvedValue({ topics: ['test'], combinedQuery: 'test' })
      mockDiscoverRelationships.mockResolvedValue({ relationshipsCreated: 0, productScopeId: null, errors: [] })

      await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(mockExtractTopics).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('catches errors from loadEntityContent and returns error message', async () => {
      mockLoadEntityContent.mockRejectedValue(new Error('DB connection failed'))

      const result = await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(result).toEqual({
        projectId: PROJECT_ID,
        entityType: 'session',
        entityId: ENTITY_ID,
        relationshipsCreated: 0,
        productScopeId: null,
        errors: ['DB connection failed'],
        createdContactId: null,
        createdIssueIds: [],
        issueResults: [],
        pmAction: null,
        pmSkipReason: null,
      })
    })

    it('catches errors from extractTopics and returns error message', async () => {
      mockLoadEntityContent.mockResolvedValue({
        contentForSearch: 'content',
        contentForTextMatch: 'content',
        entityName: 'Test',
        guidelines: null,
      })
      mockExtractTopics.mockRejectedValue(new Error('LLM timeout'))

      const result = await evaluateEntityRelationships(PROJECT_ID, 'issue', ENTITY_ID)
      expect(result.errors).toEqual(['LLM timeout'])
      expect(result.relationshipsCreated).toBe(0)
    })

    it('catches errors from discoverRelationships and returns error message', async () => {
      mockLoadEntityContent.mockResolvedValue({
        contentForSearch: 'content',
        contentForTextMatch: 'content',
        entityName: 'Test',
        guidelines: null,
      })
      mockExtractTopics.mockResolvedValue({ topics: ['test'], combinedQuery: 'test' })
      mockDiscoverRelationships.mockRejectedValue(new Error('Discovery failed'))

      const result = await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(result.errors).toEqual(['Discovery failed'])
    })

    it('returns "Unknown error" when thrown value is not an Error instance', async () => {
      mockLoadEntityContent.mockRejectedValue('string error')

      const result = await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(result.errors).toEqual(['Unknown error'])
    })

    it('preserves projectId, entityType, entityId in error response', async () => {
      mockLoadEntityContent.mockRejectedValue(new Error('fail'))

      const result = await evaluateEntityRelationships(PROJECT_ID, 'knowledge_source', ENTITY_ID)
      expect(result.projectId).toBe(PROJECT_ID)
      expect(result.entityType).toBe('knowledge_source')
      expect(result.entityId).toBe(ENTITY_ID)
    })
  })

  describe('data flow integrity', () => {
    it('does not pass contentForTextMatch to extractTopics', async () => {
      mockLoadEntityContent.mockResolvedValue({
        contentForSearch: 'search only',
        contentForTextMatch: 'text match only',
        entityName: 'Name',
        guidelines: null,
      })
      mockExtractTopics.mockResolvedValue({ topics: ['t'], combinedQuery: 't' })
      mockDiscoverRelationships.mockResolvedValue({ relationshipsCreated: 0, productScopeId: null, errors: [] })

      await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)

      // extractTopics receives contentForSearch, not contentForTextMatch
      const extractCall = mockExtractTopics.mock.calls[0]
      expect(extractCall[0]).toBe('search only')
      expect(extractCall).not.toContain('text match only')
    })

    it('passes contentForTextMatch to discoverRelationships', async () => {
      mockLoadEntityContent.mockResolvedValue({
        contentForSearch: 'search',
        contentForTextMatch: 'text match content for discovery',
        entityName: 'Name',
        guidelines: null,
      })
      mockExtractTopics.mockResolvedValue({ topics: ['t'], combinedQuery: 't' })
      mockDiscoverRelationships.mockResolvedValue({ relationshipsCreated: 0, productScopeId: null, errors: [] })

      await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(mockDiscoverRelationships).toHaveBeenCalledWith(
        expect.objectContaining({ contentForTextMatch: 'text match content for discovery' }),
      )
    })

    it('passes guidelines from loadEntityContent to extractTopics', async () => {
      mockLoadEntityContent.mockResolvedValue({
        contentForSearch: 'content',
        contentForTextMatch: 'content',
        entityName: 'Name',
        guidelines: 'focus on API topics',
      })
      mockExtractTopics.mockResolvedValue({ topics: ['t'], combinedQuery: 't' })
      mockDiscoverRelationships.mockResolvedValue({ relationshipsCreated: 0, productScopeId: null, errors: [] })

      await evaluateEntityRelationships(PROJECT_ID, 'session', ENTITY_ID)
      expect(mockExtractTopics).toHaveBeenCalledWith('content', 'Name', 'session', 'focus on API topics', PROJECT_ID)
    })
  })
})
