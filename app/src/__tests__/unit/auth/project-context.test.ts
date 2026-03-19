import { describe, it, expect } from 'vitest'
import type { NextRequest } from 'next/server'
import { MissingProjectIdError, requireProjectId } from '@/lib/auth/project-context'

function createMockRequest(url: string) {
  return {
    nextUrl: new URL(url, 'http://localhost'),
  } as unknown as NextRequest
}

describe('project-context', () => {
  describe('MissingProjectIdError', () => {
    it('has status 400', () => {
      const error = new MissingProjectIdError()
      expect(error.status).toBe(400)
    })

    it('has the expected message', () => {
      const error = new MissingProjectIdError()
      expect(error.message).toBe('projectId query parameter is required.')
    })
  })

  describe('requireProjectId', () => {
    it('returns projectId when present in query params', () => {
      const request = createMockRequest('/api/test?projectId=proj_123')
      const result = requireProjectId(request)
      expect(result).toBe('proj_123')
    })

    it('throws MissingProjectIdError when projectId is missing', () => {
      const request = createMockRequest('/api/test')
      expect(() => requireProjectId(request)).toThrow(MissingProjectIdError)
    })

    it('throws MissingProjectIdError when projectId is empty string', () => {
      const request = createMockRequest('/api/test?projectId=')
      expect(() => requireProjectId(request)).toThrow(MissingProjectIdError)
    })
  })
})
