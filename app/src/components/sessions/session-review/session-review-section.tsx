'use client'

import { Spinner } from '@/components/ui'
import { cn } from '@/lib/utils/class'
import type { SessionWithProject } from '@/types/session'
import type { SessionReviewResult as SessionReviewResultType, WorkflowStep } from '@/hooks/use-session-review'
import { SessionTagList } from '../session-tags/session-tag-badge'
import { SessionReviewResult } from './session-review-result'
import { LinkedIssuesDisplay } from './linked-issues-display'

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Display step-specific result data
 */
function StepResultBadge({ step }: { step: WorkflowStep }) {
  const data = step.data
  if (!data) return null

  const tagCount = data.tagCount as number | undefined
  const duplicateCount = data.duplicateCount as number | undefined
  const impactScore = data.impactScore as number | undefined
  const effort = data.effort as string | undefined

  switch (step.id) {
    case 'classify-session':
      return tagCount ? (
        <span className="text-xs text-[color:var(--text-secondary)]">{tagCount} tags</span>
      ) : null
    case 'find-duplicates':
      return duplicateCount !== undefined ? (
        <span className="text-xs text-[color:var(--text-secondary)]">{duplicateCount} similar</span>
      ) : null
    case 'analyze-impact':
      return impactScore ? (
        <span className="text-xs text-[color:var(--text-secondary)]">Impact: {impactScore}/5</span>
      ) : null
    case 'estimate-effort':
      return effort ? (
        <span className="text-xs text-[color:var(--text-secondary)]">Effort: {effort}</span>
      ) : null
    default:
      return null
  }
}

interface SessionReviewSectionProps {
  session: SessionWithProject
  isReviewing: boolean
  result: SessionReviewResultType | null
  showResult: boolean
  reviewTags: string[]
  steps: WorkflowStep[]
  onTriggerReview: () => void
}

export function SessionReviewSection({
  session,
  isReviewing,
  result,
  showResult,
  reviewTags,
  steps,
  onTriggerReview,
}: SessionReviewSectionProps) {
  const wasReviewed = Boolean(session.pm_reviewed_at)
  const linkedIssues = session.linked_issues ?? []
  const hasLinkedIssues = linkedIssues.length > 0

  // Show fresh result if available, otherwise show persisted linked issues
  const showFreshResult = showResult && result && !isReviewing
  const showPersistedResult = !showFreshResult && !isReviewing && wasReviewed

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Session Review
          </label>
          {wasReviewed && (
            <p className="text-xs text-[color:var(--text-secondary)]">
              Last reviewed: {formatDateTime(session.pm_reviewed_at!)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onTriggerReview}
          disabled={isReviewing}
          className="rounded-[4px] border-2 border-[color:var(--accent-primary)] bg-transparent px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--accent-primary)] transition hover:bg-[color:var(--accent-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isReviewing ? 'Analyzing...' : wasReviewed ? 'Re-analyze' : 'Run Review'}
        </button>
      </div>

      {/* Step-by-step progress visualization */}
      {isReviewing && (
        <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
          <div className="space-y-2">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-3">
                {/* Status icon */}
                {step.status === 'completed' && (
                  <span className="flex h-5 w-5 items-center justify-center text-[color:var(--accent-success)]">✓</span>
                )}
                {step.status === 'running' && (
                  <span className="flex h-5 w-5 items-center justify-center">
                    <Spinner size="sm" />
                  </span>
                )}
                {step.status === 'pending' && (
                  <span className="flex h-5 w-5 items-center justify-center text-[color:var(--text-tertiary)]">○</span>
                )}
                {step.status === 'error' && (
                  <span className="flex h-5 w-5 items-center justify-center text-[color:var(--accent-danger)]">✕</span>
                )}

                {/* Step name and message */}
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      step.status === 'completed' && 'text-[color:var(--text-secondary)]',
                      step.status === 'running' && 'text-[color:var(--foreground)]',
                      step.status === 'pending' && 'text-[color:var(--text-tertiary)]',
                      step.status === 'error' && 'text-[color:var(--accent-danger)]'
                    )}
                  >
                    {step.name}
                  </span>
                  {step.status === 'running' && step.message && (
                    <span className="ml-2 text-xs text-[color:var(--text-secondary)]">{step.message}</span>
                  )}
                </div>

                {/* Step-specific data badges */}
                {step.status === 'completed' && <StepResultBadge step={step} />}
              </div>
            ))}
          </div>

          {/* Show tags when classification completes */}
          {reviewTags.length > 0 && (
            <div className="mt-3 border-t border-[color:var(--border-subtle)] pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[color:var(--text-secondary)]">Tags:</span>
                <SessionTagList tags={reviewTags} size="sm" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show fresh result from current analysis */}
      {showFreshResult && (
        <SessionReviewResult result={result} />
      )}

      {/* Show persisted result from database */}
      {showPersistedResult && (
        hasLinkedIssues ? (
          <LinkedIssuesDisplay issues={linkedIssues} />
        ) : (
          <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
            <div className="flex items-center gap-2">
              <span className="text-lg text-[color:var(--text-tertiary)]">—</span>
              <div>
                <p className="font-medium text-[color:var(--foreground)]">No issues found</p>
                <p className="text-xs text-[color:var(--text-secondary)]">
                  Session does not contain actionable feedback
                </p>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}
