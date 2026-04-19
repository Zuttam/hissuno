/**
 * Generic OAuth 2.0 authorization-code helpers for plugins that declare
 * `auth: { type: 'oauth2', ... }`. Handles authorize URL construction,
 * state signing, token exchange, and refresh.
 *
 * Per-provider quirks (custom token request body, non-standard refresh) are
 * handled via `extraAuthParams` / `extraTokenParams` on the AuthSchema or by
 * falling back to `auth: { type: 'custom', ... }`.
 */

import crypto from 'crypto'
import type { OAuth2AuthSchema, OAuth2Tokens, Logger } from '../plugin-kit'

const STATE_SECRET_ENV = 'INTEGRATION_OAUTH_STATE_SECRET'

/**
 * Payload signed into the OAuth state param. On callback the runtime verifies
 * the signature and reconstructs the target connection context.
 */
export interface OAuthStatePayload {
  /** Hissuno project the connection lives under. */
  projectId: string
  /** User initiating the connect flow (for additional verification). */
  userId: string
  /** If present, the callback updates this connection (reconnect flow). */
  connectionId?: string
  /** Plugin id (for defense-in-depth: rejects callback to wrong plugin). */
  pluginId: string
  /** Short-lived nonce (milliseconds since epoch of state creation). */
  issuedAt: number
  /** Optional extra data the plugin wants to thread through. */
  extra?: Record<string, unknown>
}

function getStateSecret(): string {
  const secret = process.env[STATE_SECRET_ENV]
  if (secret && secret.length >= 16) return secret
  // Fall back to NEXTAUTH_SECRET when the dedicated env var is absent — most
  // deployments already set one.
  const fallback = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  if (!fallback) {
    throw new Error(
      `[integrations.oauth] Missing ${STATE_SECRET_ENV} (or NEXTAUTH_SECRET/AUTH_SECRET fallback).`
    )
  }
  return fallback
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : ''
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function signState(payload: OAuthStatePayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = b64url(crypto.createHmac('sha256', getStateSecret()).update(body).digest())
  return `${body}.${sig}`
}

export function verifyState(state: string): OAuthStatePayload {
  const parts = state.split('.')
  if (parts.length !== 2) throw new Error('Invalid OAuth state format')
  const [body, sig] = parts
  const expected = b64url(crypto.createHmac('sha256', getStateSecret()).update(body).digest())
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    throw new Error('OAuth state signature mismatch')
  }
  const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as OAuthStatePayload
  // Sanity check: state older than 30 minutes is stale.
  if (Date.now() - payload.issuedAt > 30 * 60 * 1000) {
    throw new Error('OAuth state expired')
  }
  return payload
}

export function buildAuthorizeUrl(params: {
  auth: OAuth2AuthSchema
  redirectUri: string
  state: string
}): string {
  const { auth, redirectUri, state } = params
  const clientId = process.env[auth.clientIdEnv]
  if (!clientId) {
    throw new Error(`[integrations.oauth] Missing env var ${auth.clientIdEnv}`)
  }

  const url = new URL(auth.authorizeUrl)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  if (auth.scopes.length > 0) {
    url.searchParams.set('scope', auth.scopes.join(' '))
  }
  url.searchParams.set('state', state)
  for (const [k, v] of Object.entries(auth.extraAuthParams ?? {})) {
    url.searchParams.set(k, v)
  }
  return url.toString()
}

export interface ExchangeCodeParams {
  auth: OAuth2AuthSchema
  code: string
  redirectUri: string
  logger: Logger
}

export async function exchangeAuthorizationCode(
  params: ExchangeCodeParams
): Promise<OAuth2Tokens> {
  const { auth, code, redirectUri, logger } = params
  const clientId = process.env[auth.clientIdEnv]
  const clientSecret = process.env[auth.clientSecretEnv]
  if (!clientId || !clientSecret) {
    throw new Error(
      `[integrations.oauth] Missing ${auth.clientIdEnv} or ${auth.clientSecretEnv}`
    )
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    ...(auth.extraTokenParams ?? {}),
  })

  const res = await fetch(auth.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    logger.error('[oauth.exchange] token endpoint returned error', { status: res.status, body: text })
    throw new Error(`Token exchange failed (${res.status})`)
  }

  const json = (await res.json()) as Record<string, unknown>
  return parseTokenResponse(json)
}

export async function refreshAccessToken(params: {
  auth: OAuth2AuthSchema
  refreshToken: string
  logger: Logger
}): Promise<OAuth2Tokens> {
  const { auth, refreshToken, logger } = params
  const clientId = process.env[auth.clientIdEnv]
  const clientSecret = process.env[auth.clientSecretEnv]
  if (!clientId || !clientSecret) {
    throw new Error(
      `[integrations.oauth] Missing ${auth.clientIdEnv} or ${auth.clientSecretEnv}`
    )
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    ...(auth.extraTokenParams ?? {}),
  })

  const res = await fetch(auth.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    logger.error('[oauth.refresh] token endpoint returned error', { status: res.status, body: text })
    throw new Error(`Token refresh failed (${res.status})`)
  }

  const json = (await res.json()) as Record<string, unknown>
  const tokens = parseTokenResponse(json)
  // Some providers omit refresh_token on refresh — preserve the original.
  if (!tokens.refreshToken) tokens.refreshToken = refreshToken
  return tokens
}

function parseTokenResponse(json: Record<string, unknown>): OAuth2Tokens {
  const accessToken = typeof json.access_token === 'string' ? json.access_token : null
  if (!accessToken) {
    throw new Error('Token response missing access_token')
  }
  const refreshToken = typeof json.refresh_token === 'string' ? json.refresh_token : undefined
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : null
  const tokenType = typeof json.token_type === 'string' ? json.token_type : undefined
  const scope = typeof json.scope === 'string' ? json.scope : undefined

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresIn != null ? new Date(Date.now() + expiresIn * 1000) : undefined,
    tokenType,
    scope,
    raw: json,
  }
}
