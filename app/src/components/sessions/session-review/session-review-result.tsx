'use client'

import Link from 'next/link'
import type { SessionReviewResult as SessionReviewResultType } from '@/hooks/use-session-review'

interface SessionReviewResultProps {
  result: SessionReviewResultType
  projectId: string
}

export function SessionReviewResult({ result, projectId }: SessionReviewResultProps) {
  if (result.action === 'skipped') {
    return (
      <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
        <div className="flex items-center gap-2">
          <span className="text-lg text-[color:var(--text-tertiary)]">—</span>
          <div>
            <p className="font-medium text-[color:var(--foreground)]">Marked as irrelevant</p>
            <p className="text-xs text-[color:var(--text-secondary)]">
              {result.skipReason || 'Does not contain actionable feedback'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (result.action === 'created') {
    return (
      <div className="rounded-[4px] border border-[color:var(--accent-success)] bg-[color:var(--accent-success)]/10 p-3">
        <div className="flex items-center gap-2">
          <span className="text-lg text-[color:var(--accent-success)]">✓</span>
          <div>
            <p className="font-medium text-[color:var(--foreground)]">Issue created</p>
            {result.issueTitle && (
              result.issueId ? (
                <Link
                  href={`/projects/${projectId}/issues?issue=${result.issueId}`}
                  className="text-xs text-[color:var(--accent-primary)] hover:underline"
                >
                  {result.issueTitle}
                </Link>
              ) : (
                <p className="text-xs text-[color:var(--text-secondary)]">{result.issueTitle}</p>
              )
            )}
          </div>
        </div>
      </div>
    )
  }

  if (result.action === 'upvoted') {
    return (
      <div className="rounded-[4px] border border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)]/10 p-3">
        <div className="flex items-center gap-2">
          <span className="text-lg text-[color:var(--accent-primary)]">↑</span>
          <div>
            <p className="font-medium text-[color:var(--foreground)]">Existing issue upvoted</p>
            {result.issueTitle && (
              result.issueId ? (
                <Link
                  href={`/projects/${projectId}/issues?issue=${result.issueId}`}
                  className="text-xs text-[color:var(--accent-primary)] hover:underline"
                >
                  {result.issueTitle}
                </Link>
              ) : (
                <p className="text-xs text-[color:var(--text-secondary)]">{result.issueTitle}</p>
              )
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
