import { headers as nextHeaders } from 'next/headers'
import { UnauthorizedError, USER_ID_HEADER, USER_EMAIL_HEADER, USER_NAME_HEADER } from './server'
import { ForbiddenError } from './authorization'

export const API_KEY_ID_HEADER = 'x-api-key-id'
export const API_KEY_PROJECT_ID_HEADER = 'x-api-key-project-id'
export const API_KEY_CREATED_BY_HEADER = 'x-api-key-created-by'

export type RequestIdentity =
  | { type: 'user'; userId: string; email: string | null; name: string | null }
  | { type: 'api_key'; projectId: string; keyId: string; createdByUserId: string }

export type UserIdentity = Extract<RequestIdentity, { type: 'user' }>

/**
 * Reads proxy-injected headers to determine request identity.
 * No DB calls — all AuthN is done in the proxy.
 *
 * Returns null if neither JWT user nor API key headers are present.
 */
export async function resolveRequestIdentity(headersLike?: Headers): Promise<RequestIdentity | null> {
  const source = headersLike ?? (await nextHeaders())

  // Check user path first (authenticated via AuthJS session)
  const userId = source.get(USER_ID_HEADER)
  if (userId) {
    return {
      type: 'user',
      userId,
      email: source.get(USER_EMAIL_HEADER),
      name: source.get(USER_NAME_HEADER),
    }
  }

  // Check API key path (authenticated via proxy)
  const keyId = source.get(API_KEY_ID_HEADER)
  const projectId = source.get(API_KEY_PROJECT_ID_HEADER)
  const createdByUserId = source.get(API_KEY_CREATED_BY_HEADER)

  if (keyId && projectId && createdByUserId) {
    return {
      type: 'api_key',
      keyId,
      projectId,
      createdByUserId,
    }
  }

  return null
}

/**
 * Same as resolveRequestIdentity but throws UnauthorizedError if no identity found.
 */
export async function requireRequestIdentity(headersLike?: Headers): Promise<RequestIdentity> {
  const identity = await resolveRequestIdentity(headersLike)

  if (!identity) {
    throw new UnauthorizedError()
  }

  return identity
}

/**
 * Requires a user identity (rejects API key identities).
 * Use this for routes that only make sense for authenticated users (e.g. profile).
 */
export async function requireUserIdentity(headersLike?: Headers): Promise<UserIdentity> {
  const identity = await requireRequestIdentity(headersLike)
  if (identity.type !== 'user') {
    throw new ForbiddenError('This endpoint requires user authentication.')
  }
  return identity
}
