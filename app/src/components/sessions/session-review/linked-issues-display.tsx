'use client'

import Link from 'next/link'
import { Bug, Lightbulb, RefreshCcw, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SessionLinkedIssue } from '@/types/session'

interface LinkedIssuesDisplayProps {
  issues: SessionLinkedIssue[]
  projectId: string
}

const TYPE_ICONS: Record<SessionLinkedIssue['type'], { icon: LucideIcon; className: string }> = {
  bug: { icon: Bug, className: 'text-[color:var(--accent-danger)]' },
  feature_request: { icon: Lightbulb, className: 'text-[color:var(--accent-info)]' },
  change_request: { icon: RefreshCcw, className: 'text-[color:var(--accent-warning)]' },
}

const PRIORITY_VARIANTS: Record<SessionLinkedIssue['priority'], 'danger' | 'warning' | 'default'> = {
  high: 'danger',
  medium: 'warning',
  low: 'default',
}

export function LinkedIssuesDisplay({ issues, projectId }: LinkedIssuesDisplayProps) {
  return (
    <div className="space-y-1.5">
      {issues.map((issue) => {
        const { icon: TypeIcon, className: iconClassName } = TYPE_ICONS[issue.type]
        return (
          <Link
            key={issue.id}
            href={`/projects/${projectId}/issues?issue=${issue.id}`}
            className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 transition-colors hover:bg-[color:var(--surface-hover)]"
          >
            <TypeIcon size={14} className={iconClassName} />
            <span className="flex-1 truncate font-mono text-xs text-[color:var(--foreground)]">
              {issue.title}
            </span>
            <span className="flex items-center gap-0.5 font-mono text-[10px] text-[color:var(--text-secondary)]">
              <span>&uarr;</span>
              {issue.upvote_count}
            </span>
            {issue.priority && (
              <Badge variant={PRIORITY_VARIANTS[issue.priority]}>
                {issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}
              </Badge>
            )}
          </Link>
        )
      })}
    </div>
  )
}
