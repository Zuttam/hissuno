import { Button } from '@/components/ui/button'

export type WizardNavigationProps = {
  currentStep: number
  totalSteps: number
  canGoNext: boolean
  canGoPrevious: boolean
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
  isSubmitting: boolean
  submitLabel?: string
  submittingLabel?: string
  nextLabel?: string
  validationError?: string
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  canGoNext,
  canGoPrevious,
  onPrevious,
  onNext,
  onSubmit,
  isSubmitting,
  submitLabel = 'Submit',
  submittingLabel = 'Submitting…',
  nextLabel = 'Next',
  validationError,
}: WizardNavigationProps) {
  const isLastStep = currentStep === totalSteps
  const isFirstStep = currentStep === 1

  return (
    <div className="flex flex-col gap-4 mt-4">
      {validationError && (
        <div className="rounded-[4px] border-2 border-[--accent-danger] bg-[--surface] p-4 text-sm text-[--accent-danger] animate-fade-in">
          {validationError}
        </div>
      )}
      
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Previous Button */}
        {!isFirstStep && (
          <Button
            type="button"
            variant="secondary"
            onClick={onPrevious}
            disabled={isSubmitting || !canGoPrevious}
            className="flex-1 sm:flex-none sm:min-w-[120px]"
          >
            Previous
          </Button>
        )}

        {/* Spacer when on first step */}
        {isFirstStep && <div className="hidden sm:block sm:flex-1" />}

        {/* Next or Submit Button */}
        {isLastStep ? (
          <Button
            type="button"
            variant="primary"
            onClick={onSubmit}
            disabled={isSubmitting || !canGoNext}
            loading={isSubmitting}
            className="flex-1 sm:min-w-[200px]"
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={onNext}
            disabled={!canGoNext}
            className="flex-1 sm:flex-none sm:min-w-[120px]"
          >
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

