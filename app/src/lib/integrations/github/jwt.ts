/**
 * GitHub App JWT and Installation Token Management
 *
 * Handles:
 * - JWT generation signed with App private key
 * - Installation access token generation
 * - Token caching with TTL awareness
 */

import { createPrivateKey, createSign } from 'crypto'

// =============================================================================
// Configuration
// =============================================================================

function getAppConfig() {
  const appId = process.env.GITHUB_APP_ID
  const privateKeyEnv = process.env.GITHUB_APP_PRIVATE_KEY

  if (!appId || !privateKeyEnv) {
    throw new Error('Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY environment variables')
  }

  // Handle base64-encoded private key (prefixed with "base64:")
  let privateKey: string
  if (privateKeyEnv.startsWith('base64:')) {
    privateKey = Buffer.from(privateKeyEnv.slice(7), 'base64').toString('utf-8')
  } else {
    privateKey = privateKeyEnv
  }

  return { appId, privateKey }
}

// =============================================================================
// Token Cache (HMR-safe)
// =============================================================================

interface CachedToken {
  token: string
  expiresAt: number // Unix timestamp in ms
}

interface TokenCache {
  [installationId: string]: CachedToken
}

const globalForCache = globalThis as unknown as {
  githubTokenCache: TokenCache | undefined
}

const tokenCache: TokenCache = globalForCache.githubTokenCache ?? {}

if (process.env.NODE_ENV !== 'production') {
  globalForCache.githubTokenCache = tokenCache
}

// Buffer time before token expiry (5 minutes)
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000

// =============================================================================
// JWT Generation
// =============================================================================

/**
 * Generate a JWT for GitHub App authentication
 * Used to authenticate as the App itself (not a specific installation)
 */
export function generateAppJWT(): string {
  const { appId, privateKey } = getAppConfig()

  const now = Math.floor(Date.now() / 1000)

  // JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  // JWT payload
  const payload = {
    iss: appId,
    iat: now - 60, // 60 seconds in the past for clock drift
    exp: now + 10 * 60, // 10 minutes max
  }

  // Encode header and payload
  const headerEncoded = base64UrlEncode(JSON.stringify(header))
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload))
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`

  // Sign with RS256
  const key = createPrivateKey(privateKey)
  const sign = createSign('RSA-SHA256')
  sign.update(unsignedToken)
  const signature = sign.sign(key)
  const signatureEncoded = base64UrlEncode(signature)

  return `${unsignedToken}.${signatureEncoded}`
}

/**
 * Base64 URL encode (no padding, URL-safe characters)
 */
function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// =============================================================================
// Installation Token Generation
// =============================================================================

/**
 * Generate an installation access token for a specific installation
 * Tokens are cached and reused until they expire
 */
export async function generateInstallationToken(installationId: number): Promise<string> {
  const cacheKey = String(installationId)

  // Check cache
  const cached = tokenCache[cacheKey]
  if (cached && cached.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    return cached.token
  }

  // Generate new token
  const jwt = generateAppJWT()

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[github.jwt] Failed to generate installation token:', response.status, errorText)
    throw new Error(`Failed to generate installation token: ${response.status}`)
  }

  const data = (await response.json()) as {
    token: string
    expires_at: string
  }

  // Cache the token
  tokenCache[cacheKey] = {
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime(),
  }

  return data.token
}

// =============================================================================
// Installation Info
// =============================================================================

export type GitHubInstallationInfo = {
  id: number
  account: {
    login: string
    id: number
    type: 'User' | 'Organization'
  }
  repository_selection: 'all' | 'selected'
  permissions: Record<string, string>
}

/**
 * Get information about a specific installation
 * Used during callback to get account details
 */
export async function getInstallationInfo(installationId: number): Promise<GitHubInstallationInfo> {
  const jwt = generateAppJWT()

  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[github.jwt] Failed to get installation info:', response.status, errorText)
    throw new Error(`Failed to get installation info: ${response.status}`)
  }

  return response.json()
}

/**
 * Clear cached token for an installation
 * Call this when an installation is disconnected
 */
export function clearTokenCache(installationId: number): void {
  delete tokenCache[String(installationId)]
}
