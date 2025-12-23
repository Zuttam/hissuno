import { headers as nextHeaders } from 'next/headers'

export const USER_ID_HEADER = 'x-user-id'
export const USER_EMAIL_HEADER = 'x-user-email'

export interface SessionUser {
  id: string
  email: string | null
}

export class UnauthorizedError extends Error {
  status = 401

  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export type HeadersInput = Headers | HeadersInit | null | undefined

async function resolveHeaders(headersLike?: HeadersInput | Promise<HeadersInput>): Promise<Headers> {
  const resolved = headersLike instanceof Promise ? await headersLike : headersLike

  if (!resolved) {
    return new Headers()
  }

  if (resolved instanceof Headers) {
    return resolved
  }

  if (typeof resolved === 'object' && resolved !== null) {
    const candidate = resolved as Record<string, unknown>
    const getter = candidate.get
    if (typeof getter === 'function') {
      return candidate as unknown as Headers
    }
  }

  try {
    return new Headers(resolved as HeadersInit)
  } catch {
    return new Headers()
  }
}

async function extractUserFromHeaders(headersLike?: HeadersInput | Promise<HeadersInput>): Promise<SessionUser | null> {
  const source = await resolveHeaders(headersLike)
  const id = source.get(USER_ID_HEADER)

  if (!id) {
    return null
  }

  return {
    id,
    email: source.get(USER_EMAIL_HEADER),
  }
}

export async function getSessionUser(headersLike?: HeadersInput | Promise<HeadersInput>): Promise<SessionUser | null> {
  if (headersLike !== undefined) {
    return extractUserFromHeaders(headersLike)
  }

  return extractUserFromHeaders(nextHeaders())
}

export async function requireSessionUser(headersLike?: HeadersInput | Promise<HeadersInput>): Promise<SessionUser> {
  const user = await getSessionUser(headersLike)

  if (!user) {
    throw new UnauthorizedError()
  }

  return user
}

