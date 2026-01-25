/**
 * Unit Tests for Knowledge Analysis Service
 *
 * Tests the triggerKnowledgeAnalysis function with mocked Supabase
 * to verify correct behavior for various scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { triggerKnowledgeAnalysis } from '@/lib/knowledge/analysis-service'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Mock the mastra module
vi.mock('@/mastra', () => ({
  mastra: {
    getWorkflow: vi.fn(() => ({
      id: 'knowledge-analysis-workflow',
    })),
  },
}))

// Mock the codebase sync
vi.mock('@/lib/codebase', () => ({
  syncGitHubCodebase: vi.fn(() => Promise.resolve({ status: 'success', commitSha: 'abc123' })),
  getProjectCodebasePath: vi.fn((projectId: string, branch: string) => `/tmp/codebase/${projectId}/${branch}`),
  cleanupProjectCodebase: vi.fn(() => Promise.resolve()),
}))

// ============================================================================
// Mock Supabase Factory
// ============================================================================

interface MockQueryResult {
  data: unknown
  error: { message: string; code?: string } | null
}

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

function createMockQueryBuilder(result: MockQueryResult): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  }
  return builder
}

interface MockFromCallResults {
  projects?: MockQueryResult
  project_analyses?: MockQueryResult
  knowledge_sources?: MockQueryResult
  project_analyses_insert?: MockQueryResult
  project_analyses_update?: MockQueryResult
  knowledge_sources_update?: MockQueryResult
}

function createMockSupabase(mockResults: MockFromCallResults): SupabaseClient<Database> {
  const fromMock = vi.fn((table: string) => {
    switch (table) {
      case 'projects': {
        const result = mockResults.projects ?? { data: null, error: null }
        return createMockQueryBuilder(result)
      }
      case 'project_analyses': {
        const builder = createMockQueryBuilder(
          mockResults.project_analyses ?? { data: null, error: { message: 'Not found', code: 'PGRST116' } }
        )
        // Override insert to return different result
        builder.insert = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(
              mockResults.project_analyses_insert ?? { data: { id: 'analysis-123', metadata: {} }, error: null }
            ),
          }),
        })
        builder.update = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(
            mockResults.project_analyses_update ?? { error: null }
          ),
        })
        return builder
      }
      case 'knowledge_sources': {
        const result = mockResults.knowledge_sources ?? { data: [], error: null }
        const builder = createMockQueryBuilder(result)
        // Override select to return array for sources
        builder.select = vi.fn().mockReturnThis()
        builder.eq = vi.fn().mockReturnThis()
        builder.single = vi.fn().mockResolvedValue(result)
        // Make it return the result directly when no single() is called
        Object.assign(builder, { then: (resolve: (v: MockQueryResult) => void) => resolve(result) })
        builder.update = vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue(
            mockResults.knowledge_sources_update ?? { error: null }
          ),
        })
        return builder
      }
      default:
        return createMockQueryBuilder({ data: null, error: null })
    }
  })

  return {
    from: fromMock,
  } as unknown as SupabaseClient<Database>
}

// ============================================================================
// Tests
// ============================================================================

describe('triggerKnowledgeAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Validation', () => {
    it('returns error when project is not found', async () => {
      const mockSupabase = createMockSupabase({
        projects: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      })

      const result = await triggerKnowledgeAnalysis({
        projectId: 'non-existent',
        userId: 'user-123',
        supabase: mockSupabase,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.statusCode).toBe(404)
        expect(result.error).toContain('not found')
      }
    })

    it('returns error when no enabled sources exist', async () => {
      const mockSupabase = createMockSupabase({
        projects: {
          data: { id: 'project-123', source_code: null },
          error: null,
        },
        knowledge_sources: { data: [], error: null },
      })

      const result = await triggerKnowledgeAnalysis({
        projectId: 'project-123',
        userId: 'user-123',
        supabase: mockSupabase,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.statusCode).toBe(400)
        expect(result.error).toContain('No enabled knowledge sources')
      }
    })

    it('returns 409 when analysis is already running', async () => {
      const mockSupabase = createMockSupabase({
        projects: {
          data: { id: 'project-123', source_code: null },
          error: null,
        },
        project_analyses: {
          data: { id: 'analysis-456', status: 'running', run_id: 'run-789' },
          error: null,
        },
        knowledge_sources: {
          data: [{ id: 'source-1', type: 'raw_text', enabled: true, content: 'test' }],
          error: null,
        },
      })

      const result = await triggerKnowledgeAnalysis({
        projectId: 'project-123',
        userId: 'user-123',
        supabase: mockSupabase,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.statusCode).toBe(409)
        expect(result.error).toContain('already in progress')
        expect(result.runId).toBe('run-789')
      }
    })
  })

  describe('Source Filtering', () => {
    it('skips disabled sources', async () => {
      const mockSupabase = createMockSupabase({
        projects: {
          data: { id: 'project-123', source_code: null },
          error: null,
        },
        knowledge_sources: {
          data: [
            { id: 'source-1', type: 'raw_text', enabled: false, content: 'disabled' },
            { id: 'source-2', type: 'raw_text', enabled: true, content: 'enabled' },
          ],
          error: null,
        },
        project_analyses_insert: {
          data: { id: 'analysis-123', metadata: {} },
          error: null,
        },
      })

      const result = await triggerKnowledgeAnalysis({
        projectId: 'project-123',
        userId: 'user-123',
        supabase: mockSupabase,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.sourceCount).toBe(1) // Only enabled source
      }
    })

    it('returns error when all sources are disabled', async () => {
      const mockSupabase = createMockSupabase({
        projects: {
          data: { id: 'project-123', source_code: null },
          error: null,
        },
        knowledge_sources: {
          data: [
            { id: 'source-1', type: 'raw_text', enabled: false, content: 'disabled' },
          ],
          error: null,
        },
      })

      const result = await triggerKnowledgeAnalysis({
        projectId: 'project-123',
        userId: 'user-123',
        supabase: mockSupabase,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.statusCode).toBe(400)
      }
    })
  })

  describe('Codebase Detection', () => {
    it('correctly identifies when codebase is present and enabled', async () => {
      const mockSupabase = createMockSupabase({
        projects: {
          data: {
            id: 'project-123',
            source_code: null, // Not used - source_code is joined via knowledge_sources
          },
          error: null,
        },
        knowledge_sources: {
          data: [
            {
              id: 'source-1',
              type: 'codebase',
              enabled: true,
              source_code: {
                id: 'sc-1',
                kind: 'github',
                repository_url: 'https://github.com/test/repo',
                repository_branch: 'main',
              },
            },
          ],
          error: null,
        },
        project_analyses_insert: {
          data: { id: 'analysis-123', metadata: {} },
          error: null,
        },
      })

      const result = await triggerKnowledgeAnalysis({
        projectId: 'project-123',
        userId: 'user-123',
        supabase: mockSupabase,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.hasCodebase).toBe(true)
      }
    })

    it('reports hasCodebase as false when codebase source is disabled', async () => {
      const mockSupabase = createMockSupabase({
        projects: {
          data: {
            id: 'project-123',
            source_code: null, // Not used - source_code is joined via knowledge_sources
          },
          error: null,
        },
        knowledge_sources: {
          data: [
            {
              id: 'source-1',
              type: 'codebase',
              enabled: false,
              source_code: {
                id: 'sc-1',
                kind: 'github',
                repository_url: 'https://github.com/test/repo',
                repository_branch: 'main',
              },
            },
            { id: 'source-2', type: 'raw_text', enabled: true, content: 'test' },
          ],
          error: null,
        },
        project_analyses_insert: {
          data: { id: 'analysis-123', metadata: {} },
          error: null,
        },
      })

      const result = await triggerKnowledgeAnalysis({
        projectId: 'project-123',
        userId: 'user-123',
        supabase: mockSupabase,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.hasCodebase).toBe(false)
      }
    })

    it('reports hasCodebase as false when no source_code configured', async () => {
      const mockSupabase = createMockSupabase({
        projects: {
          data: { id: 'project-123', source_code: null },
          error: null,
        },
        knowledge_sources: {
          data: [
            { id: 'source-1', type: 'codebase', enabled: true, source_code: null },
            { id: 'source-2', type: 'raw_text', enabled: true, content: 'test' },
          ],
          error: null,
        },
        project_analyses_insert: {
          data: { id: 'analysis-123', metadata: {} },
          error: null,
        },
      })

      const result = await triggerKnowledgeAnalysis({
        projectId: 'project-123',
        userId: 'user-123',
        supabase: mockSupabase,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // Codebase source exists but no source_code configured
        expect(result.hasCodebase).toBe(false)
      }
    })
  })

  describe('Analysis Record Creation', () => {
    it('creates analysis record with correct metadata', async () => {
      const insertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'analysis-123', metadata: {} },
            error: null,
          }),
        }),
      })

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'projects') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'project-123', source_code: null },
                error: null,
              }),
            }
          }
          if (table === 'project_analyses') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found', code: 'PGRST116' },
              }),
              insert: insertSpy,
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }
          }
          if (table === 'knowledge_sources') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
                resolve({
                  data: [{ id: 'source-1', type: 'raw_text', enabled: true, content: 'test' }],
                  error: null,
                }),
              update: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ error: null }),
              }),
            }
          }
          return createMockQueryBuilder({ data: null, error: null })
        }),
      } as unknown as SupabaseClient<Database>

      const result = await triggerKnowledgeAnalysis({
        projectId: 'project-123',
        userId: 'user-123',
        supabase: mockSupabase,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.runId).toMatch(/^knowledge-project-123-\d+$/)
        expect(result.analysisId).toBe('analysis-123')
      }

      // Verify insert was called
      expect(insertSpy).toHaveBeenCalled()
      const insertCall = insertSpy.mock.calls[0][0]
      expect(insertCall.project_id).toBe('project-123')
      expect(insertCall.status).toBe('running')
      expect(insertCall.metadata.sourceCount).toBe(1)
    })
  })

  // Note: GitHub sync is now handled inside the workflow via the prepare-codebase step,
  // so the skipGitHubSync parameter no longer exists. Codebase sync tests should be
  // integration tests that test the full workflow execution.
})
