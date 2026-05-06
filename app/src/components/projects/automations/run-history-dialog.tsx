'use client'

import { useEffect, useState } from 'react'
import { Badge, Button, Dialog, Spinner, Text } from '@/components/ui'
import { formatRelativeTime } from '@/lib/utils/format-time'

interface RunRow {
  runId: string
  status: string
  triggerType: string
  ranAt: string
  completedAt: string | null
  durationMs: number | null
  error: { message?: string } | null
}

interface Props {
  open: boolean
  projectId: string
  skillId: string
  onCloseAction: () => void
  onOpenRunAction: (runId: string) => void
}

export function RunHistoryDialog({ open, projectId, skillId, onCloseAction, onOpenRunAction }: Props) {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/automations/${skillId}/runs?projectId=${projectId}&limit=20`)
        if (!res.ok) throw new Error(`Failed to load runs (${res.status})`)
        const data = (await res.json()) as { runs: RunRow[] }
        if (cancelled) return
        setRuns(data.runs)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load runs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, projectId, skillId])

  return (
    <Dialog open={open} onClose={onCloseAction} title={`Run history · ${skillId}`} size="lg">
      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner size="md" />
          </div>
        ) : error ? (
          <Text variant="muted">{error}</Text>
        ) : runs.length === 0 ? (
          <Text variant="muted">No runs yet.</Text>
        ) : (
          <ul className="flex flex-col gap-1">
            {runs.map((run) => (
              <li
                key={run.runId}
                className="flex items-center justify-between rounded-[4px] bg-[color:var(--bg-muted)] px-3 py-2 text-xs"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    <span className="text-[color:var(--text-tertiary)]">{run.triggerType}</span>
                    <span className="text-[color:var(--text-tertiary)]">
                      {formatRelativeTime(run.ranAt)}
                    </span>
                    {typeof run.durationMs === 'number' && (
                      <span className="text-[color:var(--text-tertiary)]">
                        {Math.round(run.durationMs)}ms
                      </span>
                    )}
                  </div>
                  {run.error?.message && (
                    <span className="text-[color:var(--accent-danger)] truncate">
                      {run.error.message}
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => onOpenRunAction(run.runId)}>
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="sm" onClick={onCloseAction}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function statusVariant(status: string): 'default' | 'success' | 'danger' | 'warning' {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running' || status === 'queued') return 'warning'
  return 'default'
}
