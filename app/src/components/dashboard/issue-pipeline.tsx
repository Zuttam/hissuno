'use client'

import { useRouter } from 'next/navigation'
import type { IssuePipelineStats } from '@/types/dashboard'

interface IssuePipelineProps {
  stats: IssuePipelineStats
  projectId: string
}

const stages = [
  { key: 'open' as const, label: 'Open', status: 'open', color: 'var(--accent-warning)' },
  { key: 'ready' as const, label: 'Ready', status: 'ready', color: 'var(--accent-info)' },
  { key: 'inProgress' as const, label: 'In Progress', status: 'in_progress', color: 'var(--accent-selected)' },
  { key: 'resolved' as const, label: 'Resolved', status: 'resolved', color: 'var(--accent-success)' },
  { key: 'closed' as const, label: 'Closed', status: 'closed', color: 'var(--text-secondary)' },
] as const

export function IssuePipeline({ stats, projectId }: IssuePipelineProps) {
  const router = useRouter()
  const maxCount = Math.max(...stages.map((s) => stats[s.key]), 1)

  return (
    <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
          Issue Pipeline
        </h4>
        <span className="font-mono text-[10px] text-[color:var(--text-secondary)]">
          {stats.total} total
        </span>
      </div>
      <div className="space-y-1.5">
        {stages.map((stage) => {
          const count = stats[stage.key]
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0

          return (
            <button
              key={stage.key}
              onClick={() => router.push(`/projects/${projectId}/issues?status=${stage.status}`)}
              className="group flex w-full items-center gap-3 rounded-[4px] px-2 py-1.5 transition-colors hover:bg-[color:var(--surface-hover)]"
            >
              <span className="w-[72px] text-left font-mono text-[11px] text-[color:var(--text-secondary)]">
                {stage.label}
              </span>
              <div className="relative flex-1 h-5 rounded-[2px] bg-[color:var(--surface)]">
                <div
                  className="absolute inset-y-0 left-0 rounded-[2px] transition-all duration-300"
                  style={{
                    width: `${Math.max(pct, count > 0 ? 4 : 0)}%`,
                    backgroundColor: stage.color,
                    opacity: count === 0 ? 0 : 0.8,
                  }}
                />
              </div>
              <span
                className="w-6 text-right font-mono text-xs font-bold"
                style={{ color: count > 0 ? stage.color : 'var(--text-secondary)', opacity: count === 0 ? 0.4 : 1 }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
