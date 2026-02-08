import { UnauthorizedError } from '@/lib/auth/server'

/**
 * Verifies a Bearer token from the Authorization header against an env var.
 * Throws UnauthorizedError if the token is missing or invalid.
 */
function verifyBearerToken(request: Request, envVar: string): void {
  const secret = process.env[envVar]
  if (!secret) {
    throw new Error(`${envVar} environment variable is not configured.`)
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header.')
  }

  const token = authHeader.slice(7)
  if (token !== secret) {
    throw new UnauthorizedError(`Invalid ${envVar} token.`)
  }
}

/**
 * Verifies the admin API secret from the Authorization header.
 * Throws UnauthorizedError if the secret is missing or invalid.
 */
export function verifyAdminApiSecret(request: Request): void {
  verifyBearerToken(request, 'ADMIN_API_SECRET')
}

/**
 * Verifies the cron secret from the Authorization header.
 * No-op if CRON_SECRET is not configured (allows unauthenticated in dev).
 * Throws UnauthorizedError if configured and the token is invalid.
 */
export function verifyCronSecret(request: Request): void {
  if (!process.env.CRON_SECRET) return
  verifyBearerToken(request, 'CRON_SECRET')
}
