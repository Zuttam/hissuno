/**
 * Shared sync types and constants for integration dialogs.
 * This file is client-safe (no db or server-only imports).
 */

export type SyncFrequency = 'manual' | '1h' | '6h' | '24h'

export type SyncMode = 'incremental' | 'full'

export interface SyncFilterConfig {
  [key: string]: unknown
  fromDate?: string
  toDate?: string
}

export interface SyncProgress {
  type: string
  message: string
  current: number
  total: number
}

export const FREQUENCY_OPTIONS: Array<{ value: SyncFrequency; label: string }> = [
  { value: 'manual', label: 'Manual only' },
  { value: '1h', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '24h', label: 'Daily' },
]

export function formatSyncDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleString()
}
