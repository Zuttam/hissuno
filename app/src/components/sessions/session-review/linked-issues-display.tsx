'use client'

import Link from 'next/link'
import type { SessionLinkedIssue } from '@/types/session'

interface LinkedIssuesDisplayProps {
  issues: SessionLinkedIssue[]
}

const typeLabels = {
  bug: 'Bug',
  feature_request: 'Feature',
  change_request: 'Change',
}

export function LinkedIssuesDisplay({ issues }: LinkedIssuesDisplayProps) {
  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div
          key={issue.id}
          className="rounded-[4px] border border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)]/10 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg text-[color:var(--accent-primary)]">✓</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[color:var(--accent-primary)]/20 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[color:var(--accent-primary)]">
                  {typeLabels[issue.type]}
                </span>
                <span className="text-xs text-[color:var(--text-secondary)]">
                  {issue.upvote_count} upvote{issue.upvote_count !== 1 ? 's' : ''}
                </span>
              </div>
              <Link
                href={`/issues?issue=${issue.id}`}
                className="mt-1 block truncate text-sm text-[color:var(--accent-primary)] hover:underline"
              >
                {issue.title}
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
