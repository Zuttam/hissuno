/**
 * Parses and validates a localhost port from an untrusted string.
 * Returns the port number if valid (integer in 1-65535), or null otherwise.
 */
export function parseLocalhostPort(value: string | undefined): number | null {
  if (!value) return null
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return port
}
