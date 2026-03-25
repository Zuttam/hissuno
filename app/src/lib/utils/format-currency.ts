/**
 * Format a number as a compact ARR string (e.g., "$1.2M", "$500K", "$99")
 */
export function formatARR(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}
