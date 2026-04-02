/**
 * Tests for Step 1: Load Entity Content.
 * Verifies content loading for all 5 entity types, truncation behavior,
 * null handling, and guidelines loading.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.hoisted(() => vi.fn())
const mockGetKnowledgeAnalysisSettingsAdmin = vi.hoisted(() => vi.fn())
const mockBuildContactEmbeddingText = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      sessions: { findFirst: mockFindFirst },
      issues: { findFirst: mockFindFirst },
      knowledgeSources: { findFirst: mockFindFirst },
      contacts: { findFirst: mockFindFirst },
      companies: { findFirst: mockFindFirst },
    },
  },
}))

vi.mock('@/lib/db/queries/project-settings/knowledge-analysis', () => ({
  getKnowledgeAnalysisSettingsAdmin: mockGetKnowledgeAnalysisSettingsAdmin,
}))

vi.mock('@/lib/customers/customer-embedding-service', () => ({
  buildContactEmbeddingText: mockBuildContactEmbeddingText,
}))

// Need to mock the schema imports used in `eq(sessions.id, entityId)` etc.
vi.mock('@/lib/db/schema/app', () => ({
  sessions: { id: 'sessions.id' },
  issues: { id: 'issues.id' },
  knowledgeSources: { id: 'knowledgeSources.id' },
  contacts: { id: 'contacts.id' },
  companies: { id: 'companies.id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ column: a, value: b })),
}))

import { loadEntityContent } from '@/mastra/workflows/graph-evaluation/steps/load-entity-content'

const PROJECT_ID = 'proj-1'
const ENTITY_ID = 'entity-1'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetKnowledgeAnalysisSettingsAdmin.mockResolvedValue({
    knowledge_relationship_guidelines: null,
  })
})

describe('loadEntityContent', () => {
  describe('session entity type', () => {
    it('returns name and description joined with double newline', async () => {
      mockFindFirst.mockResolvedValue({ name: 'Session A', description: 'Bug report about login' })

      const result = await loadEntityContent(PROJECT_ID, 'session', ENTITY_ID)
      expect(result.contentForSearch).toBe('Session A\n\nBug report about login')
      expect(result.contentForTextMatch).toBe('Session A\n\nBug report about login')
      expect(result.entityName).toBe('Session A')
    })

    it('truncates contentForSearch to 3000 characters', async () => {
      const longDesc = 'x'.repeat(3000)
      mockFindFirst.mockResolvedValue({ name: 'Name', description: longDesc })

      const result = await loadEntityContent(PROJECT_ID, 'session', ENTITY_ID)
      expect(result.contentForSearch.length).toBe(3000)
      // contentForTextMatch is NOT truncated
      expect(result.contentForTextMatch.length).toBeGreaterThan(3000)
    })

    it('uses "Unnamed session" when row.name is null', async () => {
      mockFindFirst.mockResolvedValue({ name: null, description: 'some desc' })

      const result = await loadEntityContent(PROJECT_ID, 'session', ENTITY_ID)
      expect(result.entityName).toBe('Unnamed session')
    })

    it('filters out null fields via filter(Boolean)', async () => {
      mockFindFirst.mockResolvedValue({ name: null, description: 'only description' })

      const result = await loadEntityContent(PROJECT_ID, 'session', ENTITY_ID)
      // Should be just "only description", not "null\n\nonly description"
      expect(result.contentForTextMatch).toBe('only description')
    })

    it('returns empty strings when entity not found in DB', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await loadEntityContent(PROJECT_ID, 'session', ENTITY_ID)
      expect(result.contentForSearch).toBe('')
      expect(result.contentForTextMatch).toBe('')
      expect(result.entityName).toBe('Unnamed session')
    })
  })

  describe('issue entity type', () => {
    it('returns name and description joined with double newline', async () => {
      mockFindFirst.mockResolvedValue({ name: 'Login Bug', description: 'Page freezes' })

      const result = await loadEntityContent(PROJECT_ID, 'issue', ENTITY_ID)
      expect(result.contentForSearch).toBe('Login Bug\n\nPage freezes')
      expect(result.contentForTextMatch).toBe('Login Bug\n\nPage freezes')
      expect(result.entityName).toBe('Login Bug')
    })

    it('truncates contentForSearch to 3000 characters', async () => {
      mockFindFirst.mockResolvedValue({ name: 'T', description: 'x'.repeat(3000) })

      const result = await loadEntityContent(PROJECT_ID, 'issue', ENTITY_ID)
      expect(result.contentForSearch.length).toBe(3000)
    })

    it('uses "Unnamed issue" when row.name is null', async () => {
      mockFindFirst.mockResolvedValue({ name: null, description: 'desc' })

      const result = await loadEntityContent(PROJECT_ID, 'issue', ENTITY_ID)
      expect(result.entityName).toBe('Unnamed issue')
    })

    it('returns empty strings when entity not found', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await loadEntityContent(PROJECT_ID, 'issue', ENTITY_ID)
      expect(result.contentForSearch).toBe('')
      expect(result.contentForTextMatch).toBe('')
    })
  })

  describe('knowledge_source entity type', () => {
    it('prefers analyzed_content over description over name', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'Source Name',
        description: 'Source Desc',
        analyzed_content: 'Analyzed content here',
      })

      const result = await loadEntityContent(PROJECT_ID, 'knowledge_source', ENTITY_ID)
      expect(result.contentForSearch).toBe('Analyzed content here')
    })

    it('falls back to description when analyzed_content is null', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'Source Name',
        description: 'Source Desc',
        analyzed_content: null,
      })

      const result = await loadEntityContent(PROJECT_ID, 'knowledge_source', ENTITY_ID)
      expect(result.contentForSearch).toBe('Source Desc')
    })

    it('falls back to name when analyzed_content and description are null', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'Source Name',
        description: null,
        analyzed_content: null,
      })

      const result = await loadEntityContent(PROJECT_ID, 'knowledge_source', ENTITY_ID)
      expect(result.contentForSearch).toBe('Source Name')
    })

    it('returns empty string when all three fields are null', async () => {
      mockFindFirst.mockResolvedValue({
        name: null,
        description: null,
        analyzed_content: null,
      })

      const result = await loadEntityContent(PROJECT_ID, 'knowledge_source', ENTITY_ID)
      expect(result.contentForSearch).toBe('')
      expect(result.contentForTextMatch).toBe('')
    })

    it('uses "Unnamed source" when row.name is null', async () => {
      mockFindFirst.mockResolvedValue({ name: null, description: 'desc', analyzed_content: null })

      const result = await loadEntityContent(PROJECT_ID, 'knowledge_source', ENTITY_ID)
      expect(result.entityName).toBe('Unnamed source')
    })

    it('truncates contentForSearch to 3000 characters', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'Name',
        description: null,
        analyzed_content: 'x'.repeat(4000),
      })

      const result = await loadEntityContent(PROJECT_ID, 'knowledge_source', ENTITY_ID)
      expect(result.contentForSearch.length).toBe(3000)
    })
  })

  describe('contact entity type', () => {
    it('calls buildContactEmbeddingText with correct field mapping', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'Engineer',
        title: 'Senior Engineer',
        notes: 'Key account',
        company: { name: 'Acme Corp' },
      })
      mockBuildContactEmbeddingText.mockReturnValue('Jane Doe jane@example.com Senior Engineer Acme Corp')

      await loadEntityContent(PROJECT_ID, 'contact', ENTITY_ID)
      expect(mockBuildContactEmbeddingText).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'Engineer',
        title: 'Senior Engineer',
        companyName: 'Acme Corp',
        notes: 'Key account',
      })
    })

    it('uses "Unknown contact" when row.name is null', async () => {
      mockFindFirst.mockResolvedValue({
        name: null,
        email: 'test@test.com',
        role: null,
        title: null,
        notes: null,
        company: null,
      })
      mockBuildContactEmbeddingText.mockReturnValue('test@test.com')

      const result = await loadEntityContent(PROJECT_ID, 'contact', ENTITY_ID)
      expect(result.entityName).toBe('Unknown contact')
    })

    it('does NOT truncate contentForSearch to 3000 characters', async () => {
      const longText = 'x'.repeat(5000)
      mockFindFirst.mockResolvedValue({
        name: 'Jane',
        email: 'jane@test.com',
        role: null,
        title: null,
        notes: null,
        company: null,
      })
      mockBuildContactEmbeddingText.mockReturnValue(longText)

      const result = await loadEntityContent(PROJECT_ID, 'contact', ENTITY_ID)
      expect(result.contentForSearch.length).toBe(5000)
    })

    it('passes empty string for name/email when row fields are null', async () => {
      mockFindFirst.mockResolvedValue({
        name: null,
        email: null,
        role: null,
        title: null,
        notes: null,
        company: null,
      })
      mockBuildContactEmbeddingText.mockReturnValue('')

      await loadEntityContent(PROJECT_ID, 'contact', ENTITY_ID)
      expect(mockBuildContactEmbeddingText).toHaveBeenCalledWith(
        expect.objectContaining({ name: '', email: '' }),
      )
    })

    it('handles null company relation', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'Jane',
        email: 'jane@test.com',
        role: null,
        title: null,
        notes: null,
        company: null,
      })
      mockBuildContactEmbeddingText.mockReturnValue('Jane jane@test.com')

      await loadEntityContent(PROJECT_ID, 'contact', ENTITY_ID)
      expect(mockBuildContactEmbeddingText).toHaveBeenCalledWith(
        expect.objectContaining({ companyName: undefined }),
      )
    })
  })

  describe('company entity type', () => {
    it('returns name, domain, industry, notes joined with space', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'Acme Corp',
        domain: 'acme.com',
        industry: 'SaaS',
        notes: 'Enterprise customer',
      })

      const result = await loadEntityContent(PROJECT_ID, 'company', ENTITY_ID)
      expect(result.contentForSearch).toBe('Acme Corp acme.com SaaS Enterprise customer')
      expect(result.contentForTextMatch).toBe('Acme Corp acme.com SaaS Enterprise customer')
    })

    it('truncates contentForSearch to 3000 characters', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'Acme',
        domain: 'acme.com',
        industry: 'SaaS',
        notes: 'x'.repeat(3000),
      })

      const result = await loadEntityContent(PROJECT_ID, 'company', ENTITY_ID)
      expect(result.contentForSearch.length).toBe(3000)
    })

    it('uses "Unknown company" when row.name is null', async () => {
      mockFindFirst.mockResolvedValue({ name: null, domain: 'test.com', industry: null, notes: null })

      const result = await loadEntityContent(PROJECT_ID, 'company', ENTITY_ID)
      expect(result.entityName).toBe('Unknown company')
    })

    it('filters out null fields via filter(Boolean)', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'Acme',
        domain: null,
        industry: null,
        notes: 'notes here',
      })

      const result = await loadEntityContent(PROJECT_ID, 'company', ENTITY_ID)
      expect(result.contentForSearch).toBe('Acme notes here')
      // No extra spaces or "null" strings
      expect(result.contentForSearch).not.toContain('null')
    })
  })

  describe('guidelines loading', () => {
    it('calls getKnowledgeAnalysisSettingsAdmin with projectId', async () => {
      mockFindFirst.mockResolvedValue({ name: 'Test', description: 'desc' })

      await loadEntityContent(PROJECT_ID, 'session', ENTITY_ID)
      expect(mockGetKnowledgeAnalysisSettingsAdmin).toHaveBeenCalledWith(PROJECT_ID)
    })

    it('returns knowledge_relationship_guidelines from settings', async () => {
      mockFindFirst.mockResolvedValue({ name: 'Test', description: 'desc' })
      mockGetKnowledgeAnalysisSettingsAdmin.mockResolvedValue({
        knowledge_relationship_guidelines: 'Focus on billing topics',
      })

      const result = await loadEntityContent(PROJECT_ID, 'session', ENTITY_ID)
      expect(result.guidelines).toBe('Focus on billing topics')
    })

    it('returns null guidelines when settings have null value', async () => {
      mockFindFirst.mockResolvedValue({ name: 'Test', description: 'desc' })
      mockGetKnowledgeAnalysisSettingsAdmin.mockResolvedValue({
        knowledge_relationship_guidelines: null,
      })

      const result = await loadEntityContent(PROJECT_ID, 'session', ENTITY_ID)
      expect(result.guidelines).toBeNull()
    })
  })
})
