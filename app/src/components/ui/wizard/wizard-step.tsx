import type { ReactNode } from 'react'

export type WizardStepProps = {
  stepNumber: number
  currentStep: number
  children: ReactNode
}

export function WizardStep({ stepNumber, currentStep, children }: WizardStepProps) {
  if (stepNumber !== currentStep) {
    return null
  }

  return (
    <div className="animate-fade-in">
      {children}
    </div>
  )
}
