'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import type { IssueWithProject } from '@/types/issue'
import type { IssueType, IssuePriority } from '@/types/issue'

interface TopIssuesListProps {
  issues: IssueWithProject[]
  projectId: string
}

const TYPE_LABELS: Record<IssueType, string> = {
  bug: 'Bug',
  feature_request: 'Feature',
  change_request: 'Change',
}

const TYPE_VARIANTS: Record<IssueType, 'danger' | 'info' | 'warning'> = {
  bug: 'danger',
  feature_request: 'info',
  change_request: 'warning',
}

const PRIORITY_VARIANTS: Record<IssuePriority, 'danger' | 'warning' | 'default'> = {
  high: 'danger',
  medium: 'warning',
  low: 'default',
}

export function TopIssuesList({ issues, projectId }: TopIssuesListProps) {
  const router = useRouter()

  return (
    <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3">
      <h4 className="mb-3 font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
        Top Issues
      </h4>
      {issues.length === 0 ? (
        <div className="flex h-[120px] items-center justify-center text-xs text-[color:var(--text-secondary)]">
          No issues yet
        </div>
      ) : (
        <div className="space-y-1.5">
          {issues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => router.push(`/projects/${projectId}/issues/${issue.id}`)}
              className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--surface-hover)]"
            >
              <span className="flex-1 truncate font-mono text-xs text-[color:var(--foreground)]">
                {issue.title}
              </span>
              <Badge variant={TYPE_VARIANTS[issue.type]}>
                {TYPE_LABELS[issue.type]}
              </Badge>
              <Badge variant={PRIORITY_VARIANTS[issue.priority]}>
                {issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}
              </Badge>
              <span className="flex items-center gap-0.5 font-mono text-[10px] text-[color:var(--text-secondary)]">
                <span>&uarr;</span>
                {issue.upvote_count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
