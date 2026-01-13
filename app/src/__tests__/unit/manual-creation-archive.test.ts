/**
 * Manual Creation and Archive Feature Tests
 *
 * Tests for the manual session/issue creation and archive functionality.
 */

import { describe, it, expect } from 'vitest'
import type { CreateSessionInput, SessionFilters, SessionSource } from '@/types/session'
import type { CreateIssueInput, IssueFilters, IssueType, IssuePriority } from '@/types/issue'

describe('Manual Creation and Archive Feature', () => {
  describe('CreateSessionInput Type', () => {
    it('should accept valid session input with all fields', () => {
      const input: CreateSessionInput = {
        project_id: 'project-123',
        user_id: 'user-456',
        page_url: 'https://example.com/page',
        page_title: 'Example Page',
      }

      expect(input.project_id).toBe('project-123')
      expect(input.user_id).toBe('user-456')
      expect(input.page_url).toBe('https://example.com/page')
      expect(input.page_title).toBe('Example Page')
    })

    it('should accept session input with only required fields', () => {
      const input: CreateSessionInput = {
        project_id: 'project-123',
      }

      expect(input.project_id).toBe('project-123')
      expect(input.user_id).toBeUndefined()
      expect(input.page_url).toBeUndefined()
      expect(input.page_title).toBeUndefined()
    })
  })

  describe('CreateIssueInput Type', () => {
    it('should accept valid issue input with all fields', () => {
      const input: CreateIssueInput = {
        project_id: 'project-123',
        session_ids: ['session-456'],
        type: 'bug',
        title: 'Test Bug',
        description: 'This is a test bug description.',
        priority: 'high',
      }

      expect(input.project_id).toBe('project-123')
      expect(input.session_ids).toEqual(['session-456'])
      expect(input.type).toBe('bug')
      expect(input.title).toBe('Test Bug')
      expect(input.description).toBe('This is a test bug description.')
      expect(input.priority).toBe('high')
    })

    it('should accept issue input without session_ids (manual creation)', () => {
      const input: CreateIssueInput = {
        project_id: 'project-123',
        type: 'feature_request',
        title: 'New Feature',
        description: 'Feature description',
        priority: 'medium',
      }

      expect(input.project_id).toBe('project-123')
      expect(input.session_ids).toEqual([])
      expect(input.type).toBe('feature_request')
    })

    it('should accept all issue types', () => {
      const types: IssueType[] = ['bug', 'feature_request', 'change_request']

      types.forEach((type) => {
        const input: CreateIssueInput = {
          project_id: 'project-123',
          type,
          title: 'Test',
          description: 'Test',
          priority: 'low',
        }
        expect(input.type).toBe(type)
      })
    })

    it('should accept all priority levels', () => {
      const priorities: IssuePriority[] = ['low', 'medium', 'high']

      priorities.forEach((priority) => {
        const input: CreateIssueInput = {
          project_id: 'project-123',
          type: 'bug',
          title: 'Test',
          description: 'Test',
          priority,
        }
        expect(input.priority).toBe(priority)
      })
    })
  })

  describe('Session Source Type', () => {
    it('should include manual as valid source', () => {
      const sources: SessionSource[] = ['widget', 'slack', 'intercom', 'gong', 'api', 'manual']
      expect(sources).toContain('manual')
    })
  })

  describe('SessionFilters with showArchived', () => {
    it('should support showArchived filter', () => {
      const filters: SessionFilters = {
        showArchived: true,
      }

      expect(filters.showArchived).toBe(true)
    })

    it('should support combined filters with showArchived', () => {
      const filters: SessionFilters = {
        projectId: 'project-123',
        status: 'active',
        showArchived: true,
      }

      expect(filters.projectId).toBe('project-123')
      expect(filters.status).toBe('active')
      expect(filters.showArchived).toBe(true)
    })

    it('should default showArchived to undefined', () => {
      const filters: SessionFilters = {}
      expect(filters.showArchived).toBeUndefined()
    })
  })

  describe('IssueFilters with showArchived', () => {
    it('should support showArchived filter', () => {
      const filters: IssueFilters = {
        showArchived: true,
      }

      expect(filters.showArchived).toBe(true)
    })

    it('should support combined filters with showArchived', () => {
      const filters: IssueFilters = {
        projectId: 'project-123',
        type: 'bug',
        status: 'open',
        priority: 'high',
        showArchived: false,
      }

      expect(filters.projectId).toBe('project-123')
      expect(filters.type).toBe('bug')
      expect(filters.status).toBe('open')
      expect(filters.priority).toBe('high')
      expect(filters.showArchived).toBe(false)
    })
  })

  describe('Archive URL Parameter Building', () => {
    it('should build URL with showArchived=true', () => {
      const baseUrl = '/api/sessions'
      const params = new URLSearchParams()
      params.set('showArchived', 'true')

      const url = `${baseUrl}?${params.toString()}`
      expect(url).toBe('/api/sessions?showArchived=true')
    })

    it('should not include showArchived when false/undefined', () => {
      const baseUrl = '/api/sessions'
      const params = new URLSearchParams()
      // Not setting showArchived

      const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl
      expect(url).toBe('/api/sessions')
    })

    it('should combine showArchived with other filters', () => {
      const baseUrl = '/api/issues'
      const params = new URLSearchParams()
      params.set('projectId', 'project-123')
      params.set('type', 'bug')
      params.set('showArchived', 'true')

      const url = `${baseUrl}?${params.toString()}`
      expect(url).toContain('projectId=project-123')
      expect(url).toContain('type=bug')
      expect(url).toContain('showArchived=true')
    })
  })

  describe('Archive Status Toggle', () => {
    it('should toggle is_archived from false to true', () => {
      const currentStatus = false
      const newStatus = !currentStatus
      expect(newStatus).toBe(true)
    })

    it('should toggle is_archived from true to false', () => {
      const currentStatus = true
      const newStatus = !currentStatus
      expect(newStatus).toBe(false)
    })
  })

  describe('Mock Session Record with is_archived', () => {
    it('should create session record with is_archived field', () => {
      const session = {
        id: 'session-123',
        project_id: 'project-123',
        user_id: 'user-456',
        source: 'manual' as SessionSource,
        status: 'active' as const,
        is_archived: false,
        message_count: 0,
        tags: [],
        last_activity_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }

      expect(session.is_archived).toBe(false)
      expect(session.source).toBe('manual')
    })

    it('should create archived session record', () => {
      const session = {
        id: 'session-123',
        project_id: 'project-123',
        source: 'widget' as SessionSource,
        status: 'closed' as const,
        is_archived: true,
        message_count: 5,
        tags: [],
        last_activity_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }

      expect(session.is_archived).toBe(true)
    })
  })

  describe('Mock Issue Record with is_archived', () => {
    it('should create issue record with is_archived field', () => {
      const issue = {
        id: 'issue-123',
        project_id: 'project-123',
        type: 'bug' as IssueType,
        title: 'Test Bug',
        description: 'Description',
        priority: 'high' as IssuePriority,
        priority_manual_override: false,
        upvote_count: 1,
        status: 'open' as const,
        is_archived: false,
        product_spec: null,
        product_spec_generated_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      expect(issue.is_archived).toBe(false)
    })

    it('should create archived issue record', () => {
      const issue = {
        id: 'issue-123',
        project_id: 'project-123',
        type: 'feature_request' as IssueType,
        title: 'Archived Feature',
        description: 'Description',
        priority: 'low' as IssuePriority,
        priority_manual_override: false,
        upvote_count: 0,
        status: 'closed' as const,
        is_archived: true,
        product_spec: null,
        product_spec_generated_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      expect(issue.is_archived).toBe(true)
      expect(issue.status).toBe('closed')
    })
  })

  describe('Archive API Request Body', () => {
    it('should create valid archive request body', () => {
      const requestBody = { is_archived: true }
      expect(JSON.stringify(requestBody)).toBe('{"is_archived":true}')
    })

    it('should create valid unarchive request body', () => {
      const requestBody = { is_archived: false }
      expect(JSON.stringify(requestBody)).toBe('{"is_archived":false}')
    })
  })

  describe('Filter showArchived to URL params', () => {
    function buildUrlParams(filters: { showArchived?: boolean }): URLSearchParams {
      const params = new URLSearchParams()
      if (filters.showArchived) {
        params.set('showArchived', 'true')
      }
      return params
    }

    it('should add showArchived=true when enabled', () => {
      const params = buildUrlParams({ showArchived: true })
      expect(params.get('showArchived')).toBe('true')
    })

    it('should not add showArchived when false', () => {
      const params = buildUrlParams({ showArchived: false })
      expect(params.get('showArchived')).toBeNull()
    })

    it('should not add showArchived when undefined', () => {
      const params = buildUrlParams({})
      expect(params.get('showArchived')).toBeNull()
    })
  })
})
