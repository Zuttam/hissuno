'use client'

import { useState, useCallback } from 'react'
import { Spinner } from '@/components/ui'
import { CheckIcon, WarningIcon } from '@/components/ui/icons'

/**
 * SSE event types from the analysis stream
 */
export type AnalysisEventType =
  | 'connected'
  | 'workflow-start'
  | 'step-start'
  | 'step-progress'
  | 'step-finish'
  | 'step-error'
  | 'workflow-finish'
  | 'error'

export interface AnalysisEvent {
  type: AnalysisEventType
  stepId?: string
  stepName?: string
  message?: string
  data?: Record<string, unknown>
  timestamp: string
}

interface AnalysisProgressBarProps {
  events: AnalysisEvent[]
  isProcessing: boolean
}

/**
 * Get the current step from events
 */
function getCurrentStep(events: AnalysisEvent[]): string | null {
  // Find the last step-start that doesn't have a corresponding step-finish
  const stepStarts = events.filter((e) => e.type === 'step-start')
  const stepFinishes = events.filter((e) => e.type === 'step-finish')

  for (let i = stepStarts.length - 1; i >= 0; i--) {
    const stepStart = stepStarts[i]
    const hasFinished = stepFinishes.some((f) => f.stepId === stepStart.stepId)
    if (!hasFinished) {
      return stepStart.stepName ?? stepStart.stepId ?? null
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
function getProgressMessages(events: AnalysisEvent[], limit = 5): string[] {
  return events
    .filter((e) => e.type === 'step-progress' && e.message)
    .slice(-limit)
    .map((e) => e.message!)
}

/**
 * A progress bar that shows workflow analysis progress with real-time updates
 */
export function AnalysisProgressBar({ events, isProcessing }: AnalysisProgressBarProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const currentStep = getCurrentStep(events)
  const progressMessages = getProgressMessages(events)
  const hasError = events.some((e) => e.type === 'error' || e.type === 'step-error')

  // Get the latest progress message as the subtitle
  const latestProgressMessage = progressMessages.length > 0 ? progressMessages[progressMessages.length - 1] : null

  // Count completed steps for the progress bar fill
  const isFinished = events.some((e) => e.type === 'workflow-finish')

  // If we're processing but have no detailed events, show generic progress
  const hasDetailedEvents = events.some((e) => e.type === 'step-start' || e.type === 'step-finish' || e.type === 'step-progress')

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  // Don't show if not processing and no events (or events have been cleared)
  if (!isProcessing && events.length === 0) {
    return null
  }

  return (
    <div className="rounded-[4px] border-2 border-[color:var(--accent-selected)] bg-[color:var(--accent-selected)]/5 p-4 mb-4">
      {/* Header with spinner and current step */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isProcessing && <Spinner size="sm" />}
          {!isProcessing && !hasError && (
            <CheckIcon className="h-5 w-5 text-[color:var(--accent-success)]" />
          )}
          {hasError && (
            <WarningIcon className="h-5 w-5 text-[color:var(--accent-warning)]" />
          )}
          <div>
            <p className="font-mono text-sm font-semibold text-[color:var(--foreground)]">
              {isProcessing
                ? currentStep ?? 'Building knowledge...'
                : hasError
                  ? 'Build completed with errors'
                  : 'Build completed'}
            </p>
            {isProcessing && latestProgressMessage ? (
              <p className="text-xs text-[color:var(--text-secondary)]">
                {latestProgressMessage}
              </p>
            ) : isProcessing ? (
              <p className="text-xs text-[color:var(--text-secondary)]">
                This may take a few minutes...
              </p>
            ) : null}
          </div>
        </div>

        {/* Expand/collapse button */}
        {progressMessages.length > 0 && (
          <button
            type="button"
            onClick={toggleExpanded}
            className="text-xs text-[color:var(--accent-selected)] hover:underline font-mono"
          >
            {isExpanded ? 'Hide details' : 'Show details'}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-[color:var(--border-subtle)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            hasError
              ? 'bg-[color:var(--accent-warning)]'
              : isProcessing
                ? 'bg-[color:var(--accent-selected)] animate-pulse'
                : 'bg-[color:var(--accent-success)]'
          }`}
          style={{
            width: isFinished || !isProcessing
              ? '100%'
              : '100%' // Full width with pulse animation during processing
          }}
        />
      </div>

      {/* Expanded details - progress messages */}
      {isExpanded && progressMessages.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[color:var(--border-subtle)]">
          <p className="text-xs text-[color:var(--text-tertiary)] mb-2 font-mono uppercase">
            Recent Activity
          </p>
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
    </div>
  )
}
