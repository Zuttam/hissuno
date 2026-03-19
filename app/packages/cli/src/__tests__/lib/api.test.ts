import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBaseUrl, apiCall, buildPath } from '../../lib/api.js'
import type { HissunoConfig } from '../../lib/config.js'

function makeConfig(base_url: string): HissunoConfig {
  return { api_key: 'test-key-123', base_url }
}

describe('getBaseUrl', () => {
  it('returns base_url directly', () => {
    expect(getBaseUrl(makeConfig('https://app.hissuno.com'))).toBe('https://app.hissuno.com')
  })

  it('returns localhost base_url', () => {
    expect(getBaseUrl(makeConfig('http://localhost:3000'))).toBe('http://localhost:3000')
  })
})

describe('buildPath', () => {
  it('returns path with no params when empty', () => {
    expect(buildPath('/api/sessions', {})).toBe('/api/sessions')
  })

  it('appends query params', () => {
    expect(buildPath('/api/sessions', { projectId: 'abc', limit: 10 })).toBe(
      '/api/sessions?projectId=abc&limit=10'
    )
  })

  it('skips undefined values', () => {
    expect(buildPath('/api/search', { projectId: 'abc', type: undefined, q: 'test' })).toBe(
      '/api/search?projectId=abc&q=test'
    )
  })

  it('encodes special characters', () => {
    expect(buildPath('/api/search', { q: 'hello world' })).toBe('/api/search?q=hello%20world')
  })
})

describe('apiCall', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends correct method and Authorization header', async () => {
    const mockResponse = { ok: true, status: 200, json: () => Promise.resolve({ id: 1 }) }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

    const config = makeConfig('http://localhost:3000')
    await apiCall(config, 'GET', '/api/projects')

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/projects', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-key-123' },
      body: undefined,
    })
  })

  it('sends JSON body with Content-Type header for POST', async () => {
    const mockResponse = { ok: true, status: 200, json: () => Promise.resolve({ success: true }) }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

    const config = makeConfig('http://localhost:3000')
    await apiCall(config, 'POST', '/api/integrations/gong/connect', { accessKey: 'abc' })

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/integrations/gong/connect', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key-123', 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey: 'abc' }),
    })
  })

  it('returns ok, status, and data for success', async () => {
    const mockResponse = { ok: true, status: 200, json: () => Promise.resolve({ connected: true }) }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

    const result = await apiCall(makeConfig('http://localhost:3000'), 'GET', '/api/test')
    expect(result).toEqual({ ok: true, status: 200, data: { connected: true } })
  })

  it('returns ok=false for error responses', async () => {
    const mockResponse = { ok: false, status: 401, json: () => Promise.resolve({ error: 'Unauthorized' }) }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

    const result = await apiCall(makeConfig('http://localhost:3000'), 'GET', '/api/test')
    expect(result).toEqual({ ok: false, status: 401, data: { error: 'Unauthorized' } })
  })

  it('handles non-JSON responses gracefully', async () => {
    const mockResponse = { ok: true, status: 204, json: () => Promise.reject(new Error('no body')) }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response)

    const result = await apiCall(makeConfig('http://localhost:3000'), 'DELETE', '/api/test')
    expect(result).toEqual({ ok: true, status: 204, data: {} })
  })
})
