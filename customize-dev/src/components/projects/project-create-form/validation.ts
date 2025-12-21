import type { FormState, StepId } from '../shared/types'

export type ValidationResult = {
  isValid: boolean
  error?: string
}

/**
 * Validates the metadata step (project details)
 * Requires: project name to be provided
 */
export function validateMetadataStep(formState: FormState): ValidationResult {
  if (!formState.name || formState.name.trim() === '') {
    return {
      isValid: false,
      error: 'Project name is required',
    }
  }

  return { isValid: true }
}

/**
 * Validates the source code step
 * Always valid - source code is optional (user can "Link Later")
 */
export function validateSourceCodeStep(formState: FormState): ValidationResult {
  // GitHub integration is coming soon
  if (formState.codebaseMode === 'github') {
    return {
      isValid: false,
      error: 'GitHub integration is coming soon',
    }
  }

  // Source code is optional - user can skip and link later
  return { isValid: true }
}

/**
 * Validates the knowledge sources step
 * Always valid - knowledge sources are optional
 */
export function validateKnowledgeSourcesStep(_formState: FormState): ValidationResult {
  // Knowledge sources are optional, always valid
  return { isValid: true }
}

/**
 * Determines if user can proceed to the next step
 */
export function canProceedToNextStep(stepId: StepId, formState: FormState): ValidationResult {
  switch (stepId) {
    case 'metadata':
      return validateMetadataStep(formState)
    case 'source-code':
      return validateSourceCodeStep(formState)
    case 'knowledge-sources':
      return validateKnowledgeSourcesStep(formState)
    default:
      return { isValid: true }
  }
}
