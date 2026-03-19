/**
 * URL validation utilities to prevent SSRF (Server-Side Request Forgery) attacks.
 *
 * Validates that user-supplied URLs do not target private/internal networks,
 * metadata endpoints, or use disallowed schemes.
 */

import { lookup } from 'dns/promises'

/**
 * Private and reserved IPv4 ranges (CIDR notation logic)
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true // Malformed = treat as private
  }

  const [a, b] = parts

  return (
    a === 10 ||                          // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) ||          // 192.168.0.0/16
    a === 127 ||                         // 127.0.0.0/8
    a === 0 ||                           // 0.0.0.0/8
    (a === 169 && b === 254) ||          // 169.254.0.0/16 (link-local / metadata)
    (a === 100 && b >= 64 && b <= 127)   // 100.64.0.0/10 (carrier-grade NAT)
  )
}

/**
 * Check if an IPv6 address is private/reserved
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80') ||
    normalized === '::' ||
    // IPv4-mapped IPv6 (::ffff:x.x.x.x)
    (normalized.startsWith('::ffff:') && isPrivateIPv4(normalized.slice(7)))
  )
}

/**
 * Blocked hostnames that resolve to internal services
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
]

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.local',
  '.internal',
  '.localhost',
]

/**
 * Validate that a URL is safe to fetch (not targeting internal resources).
 *
 * Checks:
 * - Only http/https schemes allowed
 * - Hostname is not a blocked internal name
 * - DNS resolution does not point to private/reserved IPs
 *
 * @throws Error with descriptive message if URL is unsafe
 */
export async function assertSafeUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL format.')
  }

  // Scheme check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed.')
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block IP literals directly
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (isPrivateIPv4(hostname)) {
      throw new Error('URLs targeting private IP addresses are not allowed.')
    }
    return // Public IP literal is fine
  }

  if (hostname.startsWith('[') || hostname.includes(':')) {
    // IPv6 literal
    const bare = hostname.replace(/^\[|\]$/g, '')
    if (isPrivateIPv6(bare)) {
      throw new Error('URLs targeting private IP addresses are not allowed.')
    }
    return
  }

  // Blocked hostname check
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new Error('URLs targeting internal hostnames are not allowed.')
  }
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      throw new Error('URLs targeting internal hostnames are not allowed.')
    }
  }

  // DNS resolution check (DNS rebinding protection)
  try {
    const { address } = await lookup(hostname)
    if (isPrivateIPv4(address) || isPrivateIPv6(address)) {
      throw new Error('URL resolves to a private IP address.')
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('private IP')) {
      throw err
    }
    // DNS resolution failure - could be a valid host that's temporarily unreachable.
    // We let the downstream fetch handle the error rather than blocking here.
  }
}

/**
 * Validate a URL and return a result object instead of throwing.
 */
export async function validateUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    await assertSafeUrl(url)
    return { valid: true }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Invalid URL.' }
  }
}
