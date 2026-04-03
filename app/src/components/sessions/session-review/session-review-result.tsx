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
    const createdIssues = result.issueResults?.filter(r => r.action === 'created') ?? []

    if (createdIssues.length > 1) {
      return (
        <div className="rounded-[4px] border border-[color:var(--accent-success)] bg-[color:var(--accent-success)]/10 p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg text-[color:var(--accent-success)]">✓</span>
            <div>
              <p className="font-medium text-[color:var(--foreground)]">{createdIssues.length} issues created</p>
              <ul className="mt-1 flex flex-col gap-1">
                {createdIssues.map((issue, i) => (
                  <li key={issue.issueId ?? i}>
                    {issue.issueId ? (
                      <Link
                        href={`/projects/${projectId}/issues?issue=${issue.issueId}`}
                        className="text-xs text-[color:var(--accent-primary)] hover:underline"
                      >
                        {issue.issueName ?? issue.issueId}
                      </Link>
                    ) : (
                      <span className="text-xs text-[color:var(--text-secondary)]">{issue.issueName}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-[4px] border border-[color:var(--accent-success)] bg-[color:var(--accent-success)]/10 p-3">
        <div className="flex items-center gap-2">
          <span className="text-lg text-[color:var(--accent-success)]">✓</span>
          <div>
            <p className="font-medium text-[color:var(--foreground)]">Issue created</p>
            {result.issueName && (
              result.issueId ? (
                <Link
                  href={`/projects/${projectId}/issues?issue=${result.issueId}`}
                  className="text-xs text-[color:var(--accent-primary)] hover:underline"
                >
                  {result.issueName}
                </Link>
              ) : (
                <p className="text-xs text-[color:var(--text-secondary)]">{result.issueName}</p>
              )
            )}
          </div>
        </div>
      </div>
    )
  }

  if (result.action === 'linked') {
    const linkedIssues = result.issueResults?.filter(r => r.action === 'linked') ?? []

    if (linkedIssues.length > 1) {
      return (
        <div className="rounded-[4px] border border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)]/10 p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg text-[color:var(--accent-primary)]">🔗</span>
            <div>
              <p className="font-medium text-[color:var(--foreground)]">Linked to {linkedIssues.length} existing issues</p>
              <ul className="mt-1 flex flex-col gap-1">
                {linkedIssues.map((issue, i) => (
                  <li key={issue.issueId ?? i}>
                    {issue.issueId ? (
                      <Link
                        href={`/projects/${projectId}/issues?issue=${issue.issueId}`}
                        className="text-xs text-[color:var(--accent-primary)] hover:underline"
                      >
                        {issue.issueName ?? issue.issueId}
                      </Link>
                    ) : (
                      <span className="text-xs text-[color:var(--text-secondary)]">{issue.issueName}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-[4px] border border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)]/10 p-3">
        <div className="flex items-center gap-2">
          <span className="text-lg text-[color:var(--accent-primary)]">🔗</span>
          <div>
            <p className="font-medium text-[color:var(--foreground)]">Linked to existing issue</p>
            {result.issueName && (
              result.issueId ? (
                <Link
                  href={`/projects/${projectId}/issues?issue=${result.issueId}`}
                  className="text-xs text-[color:var(--accent-primary)] hover:underline"
                >
                  {result.issueName}
                </Link>
              ) : (
                <p className="text-xs text-[color:var(--text-secondary)]">{result.issueName}</p>
              )
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
