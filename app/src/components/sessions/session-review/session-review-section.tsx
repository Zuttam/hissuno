'use client'

import { Spinner } from '@/components/ui'
import { cn } from '@/lib/utils/class'
import type { SessionWithProject } from '@/types/session'
import type { SessionReviewResult as SessionReviewResultType, WorkflowStep } from '@/hooks/use-session-review'
import { SessionTagList } from '../session-tags/session-tag-badge'
import { SessionReviewResult } from './session-review-result'

/**
 * Display step-specific result data
 */
function StepResultBadge({ step }: { step: WorkflowStep }) {
  const data = step.data
  if (!data) return null

  const tagCount = data.tagCount as number | undefined

  switch (step.id) {
    case 'graph-eval':
      return tagCount ? (
        <span className="text-xs text-[color:var(--text-secondary)]">{tagCount} relationships</span>
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
}

export function SessionReviewSection({
  session,
  isReviewing,
  result,
  showResult,
  reviewTags,
  steps,
}: SessionReviewSectionProps) {
  const isAutomationSkip = result?.action === 'skipped' && result.skipReason?.includes('disabled')
  const showFreshResult = showResult && result && !isReviewing && !isAutomationSkip

  return (
    <div className="flex flex-col gap-4">
      {/* Step-by-step progress visualization */}
      {isReviewing && (
        <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
          <div className="flex flex-col gap-2">
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

      {/* Fresh result from current analysis */}
      {!isReviewing && showFreshResult && (
        <div className="flex flex-col gap-2">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Analysis Result
          </label>
          <SessionReviewResult result={result} projectId={session.project_id} />
        </div>
      )}
    </div>
  )
}
