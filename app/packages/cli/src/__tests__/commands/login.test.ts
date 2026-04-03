import { describe, it, expect } from 'vitest'
import { handleCallbackRequest } from '../../commands/login.js'

/**
 * Tests for the login command's callback handler logic.
 * Uses the pure handleCallbackRequest function directly - no HTTP server needed.
 */

function url(path: string): URL {
  return new URL(path, 'http://localhost')
}

describe('handleCallbackRequest', () => {
  it('returns 404 for non-callback paths', () => {
    const res = handleCallbackRequest(url('/other'), 'test-state')
    expect(res.status).toBe(404)
  })

  it('returns 400 when token or state is missing', () => {
    const res = handleCallbackRequest(url('/callback?token=abc'), 'test-state')
    expect(res.status).toBe(400)
  })

  it('returns 403 when state does not match', () => {
    const res = handleCallbackRequest(url('/callback?token=abc&state=wrong-state'), 'expected-state')
    expect(res.status).toBe(403)
  })

  it('returns 200 and result with token/email/name on valid callback', () => {
    const res = handleCallbackRequest(
      url('/callback?token=jwt-123&state=my-state&email=alice@test.com&name=Alice'),
      'my-state'
    )

    expect(res.status).toBe(200)
    expect(res.result).toEqual({
      token: 'jwt-123',
      email: 'alice@test.com',
      name: 'Alice',
    })
  })

  it('defaults email and name to empty string when not provided', () => {
    const res = handleCallbackRequest(url('/callback?token=t1&state=s1'), 's1')

    expect(res.status).toBe(200)
    expect(res.result?.email).toBe('')
    expect(res.result?.name).toBe('')
  })

  it('returns no result for error responses', () => {
    const res404 = handleCallbackRequest(url('/other'), 'state')
    const res400 = handleCallbackRequest(url('/callback'), 'state')
    const res403 = handleCallbackRequest(url('/callback?token=t&state=wrong'), 'state')

    expect(res404.result).toBeUndefined()
    expect(res400.result).toBeUndefined()
    expect(res403.result).toBeUndefined()
  })
})
