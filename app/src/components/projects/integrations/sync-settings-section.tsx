'use client'

import { Save, RefreshCw } from 'lucide-react'
import { Button, Spinner, FormField, Input, Select } from '@/components/ui'
import {
  type SyncFrequency,
  type SyncMode,
  type SyncProgress,
  FREQUENCY_OPTIONS,
  formatSyncDate,
} from '@/lib/integrations/shared/sync-constants'

export interface SyncSettingsSectionProps {
  syncFrequency: SyncFrequency
  onSyncFrequencyChange: (freq: SyncFrequency) => void
  fromDate: string
  onFromDateChange: (d: string) => void
  toDate: string
  onToDateChange: (d: string) => void
  syncMode: SyncMode
  onSyncModeChange: (mode: SyncMode) => void
  isSyncing: boolean
  syncProgress: SyncProgress | null
  isUpdatingSettings: boolean
  lastSyncAt: string | null | undefined
  nextSyncAt: string | null | undefined
  onSave: () => void
  onSync: () => void
  onStopSync: () => void
  itemNounPlural: string
  integrationId: string
  hasSyncMode?: boolean
  extraSettings?: React.ReactNode
}

export function SyncSettingsSection({
  syncFrequency,
  onSyncFrequencyChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  syncMode,
  onSyncModeChange,
  isSyncing,
  syncProgress,
  isUpdatingSettings,
  lastSyncAt,
  nextSyncAt,
  onSave,
  onSync,
  onStopSync,
  itemNounPlural,
  integrationId,
  hasSyncMode = true,
  extraSettings,
}: SyncSettingsSectionProps) {
  return (
    <div className="flex flex-col gap-4 border-t border-[color:var(--border-subtle)] pt-4">
      <h4 className="text-sm font-medium text-[color:var(--foreground)]">Sync Settings</h4>

      <FormField label="Sync Frequency">
        <Select
          value={syncFrequency}
          onChange={(e) => onSyncFrequencyChange(e.target.value as SyncFrequency)}
        >
          {FREQUENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormField>

      {extraSettings}

      <div className="grid grid-cols-2 gap-4">
        <FormField label="From Date (optional)">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
          />
        </FormField>
        <FormField label="To Date (optional)">
          <Input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
          />
        </FormField>
      </div>

      {hasSyncMode && lastSyncAt && !isSyncing && (
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${integrationId}-sync-mode`}
              value="incremental"
              checked={syncMode === 'incremental'}
              onChange={() => onSyncModeChange('incremental')}
              className="mt-1"
            />
            <div>
              <span className="text-sm text-[color:var(--foreground)]">Sync new only</span>
              <p className="text-xs text-[color:var(--text-tertiary)]">
                Only import {itemNounPlural} since {formatSyncDate(lastSyncAt)}
              </p>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${integrationId}-sync-mode`}
              value="full"
              checked={syncMode === 'full'}
              onChange={() => onSyncModeChange('full')}
              className="mt-1"
            />
            <div>
              <span className="text-sm text-[color:var(--foreground)]">Sync from start date</span>
              <p className="text-xs text-[color:var(--text-tertiary)]">
                Re-scan all {itemNounPlural} from your configured date range. Already imported sessions will be skipped.
              </p>
            </div>
          </label>
        </div>
      )}

      {isSyncing && syncProgress && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span className="text-sm text-[color:var(--text-secondary)]">
              {syncProgress.message}
            </span>
          </div>
          {syncProgress.total > 0 && (
            <div className="h-2 w-full rounded-full bg-[color:var(--border-subtle)] overflow-hidden">
              <div
                className="h-full bg-[color:var(--accent-selected)] transition-all duration-300"
                style={{
                  width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onSave}
          loading={isUpdatingSettings}
        >
          <Save size={14} />
          Save
        </Button>
        {isSyncing ? (
          <Button variant="danger" size="sm" onClick={onStopSync}>
            Stop Sync
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onSync}>
            <RefreshCw size={14} />
            Sync
          </Button>
        )}
      </div>
      {nextSyncAt && (
        <p className="text-xs text-[color:var(--text-tertiary)]">
          Next automatic sync: {formatSyncDate(nextSyncAt)}
        </p>
      )}
    </div>
  )
}
