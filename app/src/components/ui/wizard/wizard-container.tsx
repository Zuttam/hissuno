import type { ReactNode } from 'react'
import type { WizardStepMetadata } from './types'

export type WizardContainerProps = {
  currentStep: number
  steps: WizardStepMetadata[]
  children: ReactNode
}

export function WizardContainer({ currentStep, steps, children }: WizardContainerProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 sm:px-0">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center gap-2 sm:gap-4">
          {steps.map((step, index) => {
            const isCompleted = step.number < currentStep
            const isCurrent = step.number === currentStep

            return (
              <div key={step.id} className="flex items-center gap-2 sm:gap-4">
                {/* Step Dot and Label */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 font-mono text-xs sm:text-sm font-bold transition-all duration-300 ${
                      isCompleted
                        ? 'border-(--accent-success) bg-(--accent-success) text-white scale-100'
                        : isCurrent
                          ? 'border-(--accent-selected) bg-(--accent-selected) text-white shadow-[0_0_0_4px_rgba(37,99,235,0.2)] scale-110'
                          : 'border-(--border-subtle) bg-(--surface) text-(--text-tertiary) scale-100'
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        className="h-4 w-4 sm:h-5 sm:w-5"
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
                  </div>
                  <div
                    className={`font-mono text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-center transition-colors duration-300 max-w-[60px] sm:max-w-none ${
                      isCurrent
                        ? 'text-[--foreground]'
                        : isCompleted
                          ? 'text-[--text-secondary]'
                          : 'text-[--text-tertiary]'
                    }`}
                  >
                    {step.title}
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 w-8 sm:w-16 transition-all duration-500 ${
                      isCompleted
                        ? 'bg-[var(--accent-success)]'
                        : 'bg-[--border-subtle]'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Form Content */}
      <div className="space-y-8">
        {children}
      </div>
    </div>
  )
}

