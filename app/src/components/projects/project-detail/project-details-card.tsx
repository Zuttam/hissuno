'use client'

import { useState } from 'react'
import type { ProjectDetailsCardProps } from './types'
import { formatTimestamp } from './utils'

export function ProjectDetailsCard({ project, isLoading, onRefresh }: ProjectDetailsCardProps) {
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

      // Refresh project data to show updated sync info
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
      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Project details
        </h3>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <DetailRow label="Name" value={project.name} />
          <DetailRow label="Description" value={project.description ?? '—'} />
          <DetailRow label="Created" value={formatTimestamp(project.created_at)} />
          <DetailRow label="Updated" value={formatTimestamp(project.updated_at)} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Source details
        </h3>
        {source ? (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <DetailRow label="Source type" value={source.kind ?? '—'} />
            {source.kind === 'github' && (
              <>
                <DetailRow label="Repository URL" value={source.repository_url ?? '—'} />
                <DetailRow label="Repository branch" value={source.repository_branch ?? '—'} />
                <DetailRow 
                  label="Last synced" 
                  value={source.synced_at ? formatTimestamp(source.synced_at) : 'Not synced yet'} 
                />
                {source.commit_sha && (
                  <DetailRow 
                    label="Commit" 
                    value={source.commit_sha.substring(0, 7)} 
                  />
                )}
                
                {/* Sync button and status */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSyncing ? 'Syncing...' : 'Sync from GitHub'}
                  </button>
                  
                  {syncError && (
                    <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                      {syncError}
                    </p>
                  )}
                  
                  {syncSuccess && (
                    <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                      {syncSuccess}
                    </p>
                  )}
                </div>
              </>
            )}
            <DetailRow 
              label="Analysis scope" 
              value={source.analysis_scope || 'Entire codebase'} 
            />
            <DetailRow label="Source created" value={formatTimestamp(source.created_at)} />
            <DetailRow label="Source updated" value={formatTimestamp(source.updated_at)} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No source code linked yet. Edit the project to attach shared code.
          </p>
        )}
      </div>
    </div>
  )
}

interface DetailRowProps {
  label: string
  value: string
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-sm text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  )
}
