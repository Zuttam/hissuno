/**
 * Format a date string as a relative time (e.g., "2h ago", "3d ago")
 * Returns "Never" if the date is null/undefined
 */
export function formatRelativeTime(date: string | null | undefined): string {
  if (!date) return 'Never'

  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}
