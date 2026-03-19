import jwt from 'jsonwebtoken'

/**
 * JWT payload for widget authentication
 */
export interface WidgetJWTPayload {
  userId: string
  userMetadata?: Record<string, string>
  iat: number
  exp: number
}

/**
 * Result of JWT verification
 */
export type JWTVerificationResult =
  | { valid: true; payload: WidgetJWTPayload }
  | { valid: false; error: string }

/**
 * Check if a request origin is allowed for a project
 *
 * @param requestOrigin - The origin from the request (e.g., "https://example.com")
 * @param allowedOrigins - Array of allowed origins from project settings
 * @returns true if origin is allowed, false otherwise
 *
 * Behavior:
 * - If allowedOrigins is null/empty → allow all (development mode)
 * - Supports wildcard matching: "*.example.com" matches "sub.example.com"
 * - Case-insensitive comparison
 */
export function isOriginAllowed(
  requestOrigin: string | null,
  allowedOrigins: string[] | null
): boolean {
  // If no allowed origins configured, allow all (dev mode)
  if (!allowedOrigins || allowedOrigins.length === 0) {
    return true
  }

  // If no origin, reject (shouldn't happen with getRequestOrigin helper)
  if (!requestOrigin) {
    return false
  }

  const normalizedOrigin = requestOrigin.toLowerCase()

  for (const allowed of allowedOrigins) {
    const normalizedAllowed = allowed.toLowerCase()

    // Exact match
    if (normalizedOrigin === normalizedAllowed) {
      return true
    }

    // Wildcard matching: *.example.com or https://*.example.com
    // Extract wildcard domain, handling both with and without protocol prefix
    let wildcardDomain: string | null = null
    if (normalizedAllowed.startsWith('*.')) {
      wildcardDomain = normalizedAllowed.slice(2) // Remove "*."
    } else {
      const wildcardMatch = normalizedAllowed.match(/^https?:\/\/\*\.(.+)$/)
      if (wildcardMatch) {
        wildcardDomain = wildcardMatch[1]
      }
    }

    if (wildcardDomain) {
      try {
        const originUrl = new URL(normalizedOrigin)
        const originHost = originUrl.host

        // Match exact domain or any subdomain
        if (originHost === wildcardDomain || originHost.endsWith('.' + wildcardDomain)) {
          return true
        }
      } catch {
        // Invalid URL, skip
      }
    }

    // Also try matching with protocol variations
    try {
      const allowedUrl = new URL(
        normalizedAllowed.startsWith('http') ? normalizedAllowed : `https://${normalizedAllowed}`
      )
      const originUrl = new URL(normalizedOrigin)

      if (allowedUrl.host === originUrl.host) {
        return true
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return false
}

/**
 * Verify a widget JWT token
 *
 * @param token - The JWT token from the widget request
 * @param secretKey - The project's secret key for verification
 * @returns Verification result with payload or error
 */
export function verifyWidgetJWT(token: string, secretKey: string): JWTVerificationResult {
  try {
    const payload = jwt.verify(token, secretKey, {
      algorithms: ['HS256'],
      clockTolerance: 60, // Allow 60 seconds clock skew
    }) as WidgetJWTPayload

    // Validate required fields
    if (!payload.userId || typeof payload.userId !== 'string') {
      return { valid: false, error: 'Token missing required userId field' }
    }

    return { valid: true, payload }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'Token expired' }
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: 'Invalid token' }
    }
    return { valid: false, error: 'Token verification failed' }
  }
}

/**
 * Generate a widget JWT token (for documentation/SDK examples)
 * Customer's backend should use this pattern to generate tokens
 *
 * @param payload - The payload to sign (userId, userMetadata)
 * @param secretKey - The project's secret key
 * @param expiresIn - Token expiration (default: 24h)
 * @returns Signed JWT token
 */
export function generateWidgetJWT(
  payload: { userId: string; userMetadata?: Record<string, string> },
  secretKey: string,
  expiresIn: string | number = '24h'
): string {
  return jwt.sign(payload, secretKey, {
    algorithm: 'HS256',
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  })
}
