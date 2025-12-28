'use client'

import { useState } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { formatTimestamp } from './utils'

interface CodebaseSectionProps {
  project: ProjectWithCodebase
  isLoading?: boolean
  onRefresh?: () => Promise<void>
}

export function CodebaseSection({ project, isLoading, onRefresh }: CodebaseSectionProps) {
  const source = project.source_code
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)

  const handleSync = async () => {
    if (isSyncing || !source) return

    setIsSyncing(true)
    setSyncError(null)
    setSyncSuccess(null)

    try {
      const response = await fetch(`/api/projects/${project.id}/source-code/sync`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync codebase')
      }

      if (data.status === 'already_up_to_date') {
        setSyncSuccess('Already up to date')
      } else if (data.status === 'synced') {
        setSyncSuccess(`Synced ${data.fileCount} files`)
      }

      if (onRefresh) {
        await onRefresh()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed'
      setSyncError(message)
    } finally {
      setIsSyncing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 border-t border-[color:var(--border-subtle)]">
        <div className="animate-pulse flex gap-6">
          <div className="h-4 w-20 rounded bg-[color:var(--surface-hover)]" />
          <div className="h-4 w-32 rounded bg-[color:var(--surface-hover)]" />
        </div>
      </div>
    )
  }

  const getSourceLabel = (kind: string | undefined | null): string => {
    if (kind === 'github') return 'GitHub'
    if (kind === 'path' || kind === 'upload') return 'Local folder'
    return 'Unknown'
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 border-t border-[color:var(--border-subtle)]">
      <DetailField
        label="Codebase"
        value={source ? getSourceLabel(source.kind) : 'Not linked'}
      />

      {source?.kind === 'github' && (
        <>
          {source.repository_url && (
            <DetailField label="Repo" value={source.repository_url.replace('https://github.com/', '')} />
          )}
          {source.repository_branch && (
            <DetailField label="Branch" value={source.repository_branch} />
          )}
          {source.commit_sha && (
            <DetailField label="Commit" value={source.commit_sha.substring(0, 7)} />
          )}
          {source.synced_at && (
            <DetailField label="Synced" value={formatTimestamp(source.synced_at)} />
          )}

          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>

          {syncError && (
            <span className="text-xs text-[color:var(--accent-danger)]">{syncError}</span>
          )}
          {syncSuccess && (
            <span className="text-xs text-[color:var(--accent-success)]">{syncSuccess}</span>
          )}
        </>
      )}

      {(source?.kind === 'path' || source?.kind === 'upload') && source.storage_uri && (
        <DetailField label="Path" value={source.storage_uri} />
      )}
    </div>
  )
}

interface DetailFieldProps {
  label: string
  value: string
}

function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
        {label}:
      </span>
      <span className="font-mono text-sm text-[color:var(--foreground)]">
        {value}
      </span>
    </div>
  )
}
