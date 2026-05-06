import type { SyncFrequency } from '../plugin-kit'

/**
 * Compute the next scheduled run from a stream frequency.
 * Returns null for `manual` and `webhook` (nothing to schedule).
 */
export function calculateNextSyncTime(frequency: SyncFrequency): string | null {
  if (frequency === 'manual' || frequency === 'webhook') return null

  const next = new Date()
  switch (frequency) {
    case '1h':
      next.setHours(next.getHours() + 1)
      break
    case '6h':
      next.setHours(next.getHours() + 6)
      break
    case '24h':
      next.setDate(next.getDate() + 1)
      break
  }
  return next.toISOString()
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}
