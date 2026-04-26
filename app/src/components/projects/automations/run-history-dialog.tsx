'use client'

import { useEffect, useState } from 'react'
import { Button, Dialog, Spinner, Text } from '@/components/ui'

type RunRow = {
  runId: string
  skillId: string
  skillVersion: string | null
  triggerType: string
  triggerEntityType: string | null
  triggerEntityId: string | null
  status: string
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  createdAt: string
  error: { message?: string } | null
}

type Props = {
  open: boolean
  skillId: string
  skillName: string
  projectId: string
  onClose: () => void
  onOpenRun: (runId: string) => void
}

export function RunHistoryDialog({ open, skillId, skillName, projectId, onClose, onOpenRun }: Props) {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    void (async () => {
      setIsLoading(true)
      try {
        const url = `/api/automations/runs?projectId=${projectId}&skillId=${encodeURIComponent(skillId)}&limit=50`
        const res = await fetch(url)
        if (!res.ok) {
          console.error('[run-history] fetch failed', res.status)
          return
        }
        const data = (await res.json()) as { runs: RunRow[] }
        setRuns(data.runs)
      } catch (err) {
        console.error('[run-history] error', err)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [open, skillId, projectId])

  return (
    <Dialog open={open} onClose={onClose} title={`Run history · ${skillName}`} size="lg">
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : runs.length === 0 ? (
          <Text variant="muted">No runs yet.</Text>
        ) : (
          <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
            {runs.map((run) => (
              <button
                key={run.runId}
                type="button"
                onClick={() => onOpenRun(run.runId)}
                className="text-left rounded-md border border-[color:var(--border-subtle)] hover:bg-[color:var(--surface-hover)] p-2 flex items-center gap-2"
              >
                <StatusPill status={run.status} />
                <span className="text-xs text-[color:var(--fg-muted)] shrink-0">
                  {run.triggerType}
                  {run.triggerEntityType ? ` · ${run.triggerEntityType}/${run.triggerEntityId?.slice(0, 8)}` : ''}
                </span>
                <span className="text-xs text-[color:var(--fg-muted)] ml-auto shrink-0">
                  {formatTime(run.createdAt)}
                  {run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  )
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === 'succeeded' ? 'var(--accent-success)' :
    status === 'failed' || status === 'cancelled' ? 'var(--accent-danger)' :
    status === 'running' ? 'var(--accent-info)' :
    'var(--fg-muted)'
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
      style={{ backgroundColor: 'var(--bg-muted)', color }}
    >
      {status}
    </span>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}
