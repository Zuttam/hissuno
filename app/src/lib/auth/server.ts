import { headers as nextHeaders } from 'next/headers'

export const USER_ID_HEADER = 'x-user-id'
export const USER_EMAIL_HEADER = 'x-user-email'
export const USER_NAME_HEADER = 'x-user-name'

export interface SessionUser {
  id: string
  email: string | null
  name: string | null
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
    name: source.get(USER_NAME_HEADER),
  }
}

export async function getSessionUser(headersLike?: HeadersInput | Promise<HeadersInput>): Promise<SessionUser | null> {
  if (headersLike !== undefined) {
    return extractUserFromHeaders(headersLike)
  }

  return extractUserFromHeaders(nextHeaders())
}

/**
 * Default paths for post-authentication redirects.
 */
const DEFAULT_REDIRECT_PATH = '/projects'

/**
 * Validates and sanitizes a redirect path to prevent open redirect vulnerabilities.
 *
 * Security measures:
 * - Only allows relative paths starting with /
 * - Blocks protocol-relative URLs (//evil.com)
 * - Blocks URLs with embedded credentials or protocols
 * - Returns a safe default if validation fails
 *
 * @param path - The redirect path to validate (from user input)
 * @param defaultPath - Fallback path if validation fails
 * @returns A safe, relative redirect path
 */
export function getSafeRedirectPath(
  path: string | null | undefined,
  defaultPath: string = DEFAULT_REDIRECT_PATH
): string {
  if (!path || typeof path !== 'string') {
    return defaultPath
  }

  const trimmed = path.trim()

  // Must start with exactly one forward slash (relative path)
  if (!trimmed.startsWith('/')) {
    return defaultPath
  }

  // Block protocol-relative URLs (//evil.com)
  if (trimmed.startsWith('//')) {
    return defaultPath
  }

  // Block any URL that contains a protocol (javascript:, data:, etc.)
  if (/^\/.*:/i.test(trimmed) || /[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return defaultPath
  }

  // Block backslash (can be normalized to forward slash by some browsers)
  if (trimmed.includes('\\')) {
    return defaultPath
  }

  // Block URLs with @ (could be interpreted as credentials)
  if (trimmed.includes('@')) {
    return defaultPath
  }

  return trimmed
}

