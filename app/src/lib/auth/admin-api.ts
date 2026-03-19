import crypto from 'crypto'
import { UnauthorizedError } from '@/lib/auth/server'

/**
 * Verifies the cron secret from the Authorization header.
 * No-op if CRON_SECRET is not configured (allows unauthenticated in dev).
 * Throws UnauthorizedError if configured and the token is invalid.
 */
export function verifyCronSecret(request: Request): void {
  if (!process.env.CRON_SECRET) return

  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header.')
  }

  const token = authHeader.slice(7)
  const tokenBuf = Buffer.from(token)
  const secretBuf = Buffer.from(secret)
  if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
    throw new UnauthorizedError('Invalid CRON_SECRET token.')
  }
}
