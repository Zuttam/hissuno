const INVITE_CODE_KEY = 'hissuno_invite_code'

/**
 * Stores the invite code in sessionStorage before OAuth redirect.
 * The code will be retrieved after callback to claim the invite.
 */
export function storeInviteCode(code: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(INVITE_CODE_KEY, code.trim().toUpperCase())
  } catch {
    // sessionStorage might be unavailable in some contexts
    console.warn('[invite-session-storage] Failed to store invite code')
  }
}

/**
 * Retrieves and clears the stored invite code from sessionStorage.
 * Returns null if no code is stored.
 */
export function retrieveAndClearInviteCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const code = sessionStorage.getItem(INVITE_CODE_KEY)
    if (code) {
      sessionStorage.removeItem(INVITE_CODE_KEY)
      return code
    }
    return null
  } catch {
    console.warn('[invite-session-storage] Failed to retrieve invite code')
    return null
  }
}

/**
 * Gets the stored invite code without clearing it.
 */
export function getStoredInviteCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(INVITE_CODE_KEY)
  } catch {
    return null
  }
}
