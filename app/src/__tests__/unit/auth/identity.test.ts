import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

import { headers as nextHeaders } from 'next/headers'
import {
  resolveRequestIdentity,
  requireRequestIdentity,
  requireUserIdentity,
} from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError } from '@/lib/auth/authorization'

const mockedNextHeaders = vi.mocked(nextHeaders)

function createHeaders(entries: Record<string, string>): Headers {
  const h = new Headers()
  for (const [k, v] of Object.entries(entries)) {
    h.set(k, v)
  }
  return h
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// resolveRequestIdentity
// ---------------------------------------------------------------------------
describe('resolveRequestIdentity', () => {
  it('returns user identity when user headers are present', async () => {
    const h = createHeaders({
      'x-user-id': 'user-123',
      'x-user-email': 'alice@example.com',
      'x-user-name': 'Alice',
    })

    const identity = await resolveRequestIdentity(h)

    expect(identity).toEqual({
      type: 'user',
      userId: 'user-123',
      email: 'alice@example.com',
      name: 'Alice',
    })
  })

  it('returns user identity with null email and name when only x-user-id is set', async () => {
    const h = createHeaders({ 'x-user-id': 'user-456' })

    const identity = await resolveRequestIdentity(h)

    expect(identity).toEqual({
      type: 'user',
      userId: 'user-456',
      email: null,
      name: null,
    })
  })

  it('returns api_key identity when all API key headers are present', async () => {
    const h = createHeaders({
      'x-api-key-id': 'key-abc',
      'x-api-key-project-id': 'proj-789',
      'x-api-key-created-by': 'user-owner',
    })

    const identity = await resolveRequestIdentity(h)

    expect(identity).toEqual({
      type: 'api_key',
      keyId: 'key-abc',
      projectId: 'proj-789',
      createdByUserId: 'user-owner',
    })
  })

  it('returns null when no identity headers are present', async () => {
    const h = createHeaders({})

    const identity = await resolveRequestIdentity(h)

    expect(identity).toBeNull()
  })

  it('returns null when x-api-key-id is missing (partial API key headers)', async () => {
    const h = createHeaders({
      'x-api-key-project-id': 'proj-789',
      'x-api-key-created-by': 'user-owner',
    })

    const identity = await resolveRequestIdentity(h)

    expect(identity).toBeNull()
  })

  it('returns null when x-api-key-project-id is missing (partial API key headers)', async () => {
    const h = createHeaders({
      'x-api-key-id': 'key-abc',
      'x-api-key-created-by': 'user-owner',
    })

    const identity = await resolveRequestIdentity(h)

    expect(identity).toBeNull()
  })

  it('returns null when x-api-key-created-by is missing (partial API key headers)', async () => {
    const h = createHeaders({
      'x-api-key-id': 'key-abc',
      'x-api-key-project-id': 'proj-789',
    })

    const identity = await resolveRequestIdentity(h)

    expect(identity).toBeNull()
  })

  it('gives user identity precedence when both user and API key headers are present', async () => {
    const h = createHeaders({
      'x-user-id': 'user-123',
      'x-user-email': 'alice@example.com',
      'x-user-name': 'Alice',
      'x-api-key-id': 'key-abc',
      'x-api-key-project-id': 'proj-789',
      'x-api-key-created-by': 'user-owner',
    })

    const identity = await resolveRequestIdentity(h)

    expect(identity).toEqual({
      type: 'user',
      userId: 'user-123',
      email: 'alice@example.com',
      name: 'Alice',
    })
  })

  it('uses the provided Headers object instead of next/headers', async () => {
    const h = createHeaders({ 'x-user-id': 'user-explicit' })

    await resolveRequestIdentity(h)

    expect(mockedNextHeaders).not.toHaveBeenCalled()
  })

  it('falls back to next/headers when no Headers argument is provided', async () => {
    const h = createHeaders({ 'x-user-id': 'user-from-next' })
    mockedNextHeaders.mockResolvedValue(h as any)

    const identity = await resolveRequestIdentity()

    expect(mockedNextHeaders).toHaveBeenCalledOnce()
    expect(identity).toEqual({
      type: 'user',
      userId: 'user-from-next',
      email: null,
      name: null,
    })
  })
})

// ---------------------------------------------------------------------------
// requireRequestIdentity
// ---------------------------------------------------------------------------
describe('requireRequestIdentity', () => {
  it('returns user identity when user headers are present', async () => {
    const h = createHeaders({
      'x-user-id': 'user-123',
      'x-user-email': 'bob@example.com',
      'x-user-name': 'Bob',
    })

    const identity = await requireRequestIdentity(h)

    expect(identity).toEqual({
      type: 'user',
      userId: 'user-123',
      email: 'bob@example.com',
      name: 'Bob',
    })
  })

  it('returns api_key identity when API key headers are present', async () => {
    const h = createHeaders({
      'x-api-key-id': 'key-xyz',
      'x-api-key-project-id': 'proj-456',
      'x-api-key-created-by': 'user-creator',
    })

    const identity = await requireRequestIdentity(h)

    expect(identity).toEqual({
      type: 'api_key',
      keyId: 'key-xyz',
      projectId: 'proj-456',
      createdByUserId: 'user-creator',
    })
  })

  it('throws UnauthorizedError when no identity headers are present', async () => {
    const h = createHeaders({})

    await expect(requireRequestIdentity(h)).rejects.toThrow(UnauthorizedError)
  })
})

// ---------------------------------------------------------------------------
// requireUserIdentity
// ---------------------------------------------------------------------------
describe('requireUserIdentity', () => {
  it('returns user identity when user headers are present', async () => {
    const h = createHeaders({
      'x-user-id': 'user-789',
      'x-user-email': 'carol@example.com',
      'x-user-name': 'Carol',
    })

    const identity = await requireUserIdentity(h)

    expect(identity).toEqual({
      type: 'user',
      userId: 'user-789',
      email: 'carol@example.com',
      name: 'Carol',
    })
  })

  it('throws ForbiddenError when identity is an API key', async () => {
    const h = createHeaders({
      'x-api-key-id': 'key-blocked',
      'x-api-key-project-id': 'proj-blocked',
      'x-api-key-created-by': 'user-blocked',
    })

    await expect(requireUserIdentity(h)).rejects.toThrow(ForbiddenError)
    await expect(requireUserIdentity(h)).rejects.toThrow(
      'This endpoint requires user authentication.'
    )
  })

  it('throws UnauthorizedError when no identity is present at all', async () => {
    const h = createHeaders({})

    await expect(requireUserIdentity(h)).rejects.toThrow(UnauthorizedError)
  })
})
