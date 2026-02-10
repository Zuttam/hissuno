'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WizardStepMetadata } from './types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/class'
import { FloatingCard } from '@/components/ui/floating-card'

export type WizardContainerProps = {
  currentStep: number
  steps: WizardStepMetadata[]
  children: ReactNode
  // Mode determines button layout ('onboarding' behaves like 'create')
  mode?: 'create' | 'edit' | 'onboarding'
  // When true, renders as a full-screen overlay with backdrop blur (like Dialog)
  overlay?: boolean
  // When true, the step is showing a reveal message — Continue is the only action
  isInRevealState?: boolean
  // Navigation props (create mode)
  onPrevious?: () => void
  onNext?: () => void
  onSubmit?: () => void
  onCancel?: () => void
  onStepClick?: (stepNumber: number) => void
  maxReachableStep?: number
  isSubmitting?: boolean
  submitLabel?: string
  submittingLabel?: string
  validationError?: string
  // Edit mode props
  onSave?: () => void
  onClose?: () => void
  saveLabel?: string
  savingLabel?: string
  saveSuccess?: boolean
}

export function WizardContainer({
  currentStep,
  steps,
  children,
  mode = 'create',
  overlay = false,
  isInRevealState = false,
  onPrevious,
  onNext,
  onSubmit,
  onCancel,
  onStepClick,
  maxReachableStep,
  isSubmitting = false,
  submitLabel = 'Submit',
  submittingLabel = 'Submitting…',
  validationError,
  onSave,
  onClose,
  saveLabel = 'Save',
  savingLabel = 'Saving…',
  saveSuccess = false,
}: WizardContainerProps) {
  const isLastStep = currentStep === steps.length
  const isFirstStep = currentStep === 1
  const isEditMode = mode === 'edit'

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock body scroll when overlay is active
  useEffect(() => {
    if (overlay && mounted) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [overlay, mounted])

  const isOnboarding = mode === 'onboarding'

  const wizardContent = (
    <FloatingCard
      floating="none"
      variant="elevated"
      className={cn(
        'flex flex-col overflow-hidden bg-[var(--background)]',
        isOnboarding
          ? 'min-h-screen md:min-h-[680px] md:max-h-[95vh] md:w-6xl md:rounded-2xl'
          : 'min-h-[calc(100vh-4rem)]'
      )}
    >
      {/* Scrollable inner container */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Sticky Navigation Bar - Glass Effect */}
        <div
          className={cn(
            // Glass effect
            'bg-[var(--background)]/80 backdrop-blur-xl backdrop-saturate-150',
            // Border and shadow for depth when scrolled
            'border-b border-[var(--border-subtle)]/50',
            'shadow-[0_2px_8px_rgba(0,0,0,0.05)]',
            'dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
          )}
        >
          <div className={cn(
            'px-6 py-4 flex items-center justify-between gap-4',
            isOnboarding ? 'sm:px-8 sm:gap-4' : 'sm:px-12 sm:gap-6 mx-auto max-w-6xl'
          )}>
            {/* Left Button: Close (edit mode) or Back/Cancel (create mode) */}
            <div className="flex-shrink-0 min-w-[100px]">
              {isEditMode ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Close
                </Button>
              ) : !isFirstStep ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onPrevious}
                  disabled={isSubmitting}
                >
                  ← Back
                </Button>
              ) : onCancel ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              ) : (
                <div className="w-[100px]" />
              )}
            </div>

            {/* Steps Indicator */}
            <div className="flex items-start gap-2 sm:gap-3 overflow-x-auto py-1">
              {steps.map((step, index) => {
                const isCompleted = step.number < currentStep
                const isCurrent = step.number === currentStep
                const effectiveMaxStep = maxReachableStep ?? steps.length
                const isClickable = onStepClick && !isSubmitting && !isCurrent && step.number <= effectiveMaxStep

                return (
                  <div key={step.id} className="flex items-start gap-2 sm:gap-3 flex-shrink-0">
                    {/* Step with Title */}
                    <div className="flex flex-col items-center gap-1.5">
                      {/* Step Dot */}
                      <button
                        type="button"
                        onClick={() => isClickable && onStepClick(step.number)}
                        disabled={!isClickable}
                        className={cn(
                          'flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 font-mono text-sm font-bold transition-all duration-300',
                          isCompleted &&
                            'border-[var(--accent-success)] bg-[var(--accent-success)] text-white shadow-md shadow-[var(--accent-success)]/25',
                          isCurrent &&
                            'border-[var(--accent-selected)] bg-[var(--accent-selected)] text-white shadow-md shadow-[var(--accent-selected)]/25',
                          !isCompleted &&
                            !isCurrent &&
                            'border-[var(--border-subtle)] bg-[var(--surface)]/80 text-[var(--text-tertiary)]',
                          isClickable && 'cursor-pointer hover:scale-110 hover:opacity-80'
                        )}
                      >
                        {isCompleted ? (
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          step.number
                        )}
                      </button>

                      {/* Step Title - visible on large screens */}
                      <span
                        className={cn(
                          'hidden lg:block text-xs font-medium max-w-[80px] text-center leading-tight transition-colors duration-300',
                          isCurrent
                            ? 'text-[var(--text-primary)]'
                            : isCompleted
                              ? 'text-[var(--text-secondary)]'
                              : 'text-[var(--text-tertiary)]'
                        )}
                      >
                        {step.title}
                      </span>
                    </div>

                    {/* Connector Line */}
                    {index < steps.length - 1 && (
                      <div
                        className={cn(
                          'h-0.5 w-6 sm:w-10 rounded-full transition-all duration-500 mt-[18px] sm:mt-[20px]',
                          isCompleted
                            ? 'bg-[var(--accent-success)]'
                            : 'bg-[var(--border-subtle)]/80'
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Right Button: Save (edit mode) or Next/Submit (create mode) */}
            <div className="flex-shrink-0 flex items-center gap-3 min-w-[100px] justify-end">
              {isEditMode ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={onSave}
                  disabled={isSubmitting || saveSuccess}
                  loading={isSubmitting}
                >
                  {saveSuccess ? '✓ Saved' : isSubmitting ? savingLabel : saveLabel}
                </Button>
              ) : isInRevealState ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={onNext}
                  disabled={isSubmitting}
                >
                  Continue
                </Button>
              ) : isLastStep ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? submittingLabel : submitLabel}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  onClick={onNext}
                  disabled={isSubmitting}
                >
                  {mode === 'onboarding' ? 'Continue' : 'Next →'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="border-b border-[var(--accent-danger)] bg-[var(--accent-danger)]/10">
            <div className={cn(
              'px-6 py-2 text-sm font-mono text-[var(--accent-danger)]',
              isOnboarding ? 'sm:px-8' : 'sm:px-12 mx-auto max-w-6xl'
            )}>
              {validationError}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 py-6">
          <div className={cn(
            'px-6',
            isOnboarding ? 'sm:px-8' : 'sm:px-12 mx-auto max-w-6xl'
          )}>
            {children}
          </div>
        </div>
      </div>
    </FloatingCard>
  )

  // Overlay mode: portal to body with backdrop blur (same pattern as Dialog)
  if (overlay && mounted) {
    return createPortal(
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm" aria-hidden="true" />
        {/* Scrollable wizard container */}
        <div className={cn(
          'fixed inset-0 z-[70] overflow-y-auto',
          isOnboarding && 'md:flex md:items-center md:justify-center md:p-6'
        )}>
          {wizardContent}
        </div>
      </>,
      document.body
    )
  }

  return wizardContent
}
