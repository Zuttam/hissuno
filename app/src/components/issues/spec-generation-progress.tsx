'use client'

import { useState, useCallback } from 'react'
import { Spinner, Button } from '@/components/ui'
import type { SpecGenerationEvent } from '@/hooks/use-spec-generation'

interface SpecGenerationProgressProps {
  events: SpecGenerationEvent[]
  isProcessing: boolean
  onCancel?: () => void
  streamedText?: string
  activeTools?: string[]
}

/**
 * Get the current step from events
 */
function getCurrentStep(events: SpecGenerationEvent[]): string | null {
  // Find the last step-start that doesn't have a corresponding step-finish
  const stepStarts = events.filter((e) => e.type === 'step-start')
  const stepFinishes = events.filter((e) => e.type === 'step-finish')

  for (let i = stepStarts.length - 1; i >= 0; i--) {
    const stepStart = stepStarts[i]
    const hasFinished = stepFinishes.some((f) => f.stepId === stepStart.stepId)
    if (!hasFinished) {
      return stepStart.stepName ?? stepStart.message ?? null
    }
  }

  // If all steps finished, return the last one
  if (stepFinishes.length > 0) {
    return stepFinishes[stepFinishes.length - 1].stepName ?? null
  }

  return null
}

/**
 * Get progress messages (only the most recent ones)
 */
function getProgressMessages(events: SpecGenerationEvent[], limit = 5): string[] {
  return events
    .filter((e) => e.type === 'step-progress' && e.message)
    .slice(-limit)
    .map((e) => e.message!)
}

/**
 * Progress indicator for spec generation with real-time updates
 */
export function SpecGenerationProgress({
  events,
  isProcessing,
  onCancel,
  streamedText = '',
  activeTools = [],
}: SpecGenerationProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showLivePreview, setShowLivePreview] = useState(false)

  const currentStep = getCurrentStep(events)
  const progressMessages = getProgressMessages(events)
  const hasError = events.some((e) => e.type === 'error')
  const isComplete = events.some((e) => e.type === 'workflow-finish')

  // Get totalSteps from workflow-start event, default to 1
  const workflowStartEvent = events.find((e) => e.type === 'workflow-start')
  const totalSteps = (workflowStartEvent?.data?.totalSteps as number) || 1
  const completedSteps = events.filter((e) => e.type === 'step-finish').length

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  // Don't show if not processing and no events
  if (!isProcessing && events.length === 0) {
    return null
  }

  return (
    <div className="rounded-[4px] border-2 border-[color:var(--accent-selected)] bg-[color:var(--accent-selected)]/5 p-4">
      {/* Header with spinner and current step */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isProcessing && <Spinner size="sm" />}
          {!isProcessing && isComplete && !hasError && (
            <svg
              className="h-5 w-5 text-[color:var(--accent-success)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {hasError && (
            <svg
              className="h-5 w-5 text-[color:var(--accent-danger)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
          <div>
            <p className="font-mono text-sm font-semibold text-[color:var(--foreground)]">
              {isProcessing
                ? currentStep ?? 'Generating specification...'
                : hasError
                  ? 'Generation failed'
                  : 'Specification generated'}
            </p>
            {(totalSteps > 1 || !isProcessing) && (
              <p className="text-xs text-[color:var(--text-secondary)]">
                {isProcessing
                  ? `${completedSteps} of ${totalSteps} steps completed`
                  : hasError
                    ? 'Please try again'
                    : 'View below'}
              </p>
            )}
          </div>
        </div>

        {/* Cancel button */}
        {isProcessing && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-xs"
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-[color:var(--border-subtle)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            hasError
              ? 'bg-[color:var(--accent-danger)]'
              : isProcessing
                ? 'bg-[color:var(--accent-selected)] animate-pulse'
                : 'bg-[color:var(--accent-success)]'
          }`}
          style={{
            width: `${(completedSteps / totalSteps) * 100}%`,
          }}
        />
      </div>

      {/* Active tools indicator */}
      {activeTools.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeTools.map((tool) => (
            <span
              key={tool}
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent-selected)]/10 px-2.5 py-0.5 text-xs font-mono text-[color:var(--accent-selected)]"
            >
              <Spinner size="sm" className="h-3 w-3" />
              {tool}
            </span>
          ))}
        </div>
      )}

      {/* Expand/collapse for progress messages */}
      {(progressMessages.length > 0 || streamedText) && (
        <>
          <div className="mt-2 flex gap-2">
            {progressMessages.length > 0 && (
              <button
                type="button"
                onClick={toggleExpanded}
                className="text-xs text-[color:var(--accent-selected)] hover:underline font-mono"
              >
                {isExpanded ? 'Hide details' : 'Show details'}
              </button>
            )}
            {streamedText && (
              <button
                type="button"
                onClick={() => setShowLivePreview((prev) => !prev)}
                className="text-xs text-[color:var(--accent-selected)] hover:underline font-mono"
              >
                {showLivePreview ? 'Hide preview' : 'Show live preview'}
              </button>
            )}
          </div>

          {isExpanded && progressMessages.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[color:var(--border-subtle)]">
              <ul className="space-y-1">
                {progressMessages.map((msg, idx) => (
                  <li key={idx} className="text-xs text-[color:var(--text-secondary)] flex items-start gap-2">
                    <span className="text-[color:var(--accent-selected)]">›</span>
                    <span>{msg}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showLivePreview && streamedText && (
            <div className="mt-2 pt-2 border-t border-[color:var(--border-subtle)]">
              <p className="text-xs font-mono text-[color:var(--text-secondary)] mb-1">Live output:</p>
              <div className="max-h-32 overflow-y-auto rounded bg-[color:var(--surface)] p-2 text-xs text-[color:var(--foreground)] font-mono whitespace-pre-wrap">
                {streamedText}
                <span className="animate-pulse">▊</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
