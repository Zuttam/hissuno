import { useCallback } from 'react'
import type { ProjectWizardFormData, ProjectStepId } from '../shared/wizard/steps'

const FORM_STATE_KEY = 'project-wizard-form-state'
const MAX_AGE = 30 * 60 * 1000 // 30 minutes

interface PersistedState {
  formData: ProjectWizardFormData
  currentStepId: ProjectStepId
  timestamp: number
}

interface UseFormPersistenceProps {
  formData: ProjectWizardFormData
  currentStepId: ProjectStepId
}

interface UseFormPersistenceReturn {
  saveFormState: () => void
  restoreFormState: () => { formData: ProjectWizardFormData; stepId: ProjectStepId } | null
  clearFormState: () => void
}

export function useFormPersistence({
  formData,
  currentStepId,
}: UseFormPersistenceProps): UseFormPersistenceReturn {
  const saveFormState = useCallback(() => {
    const state: PersistedState = {
      formData,
      currentStepId,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(FORM_STATE_KEY, JSON.stringify(state))
  }, [formData, currentStepId])

  const restoreFormState = useCallback(() => {
    const saved = sessionStorage.getItem(FORM_STATE_KEY)
    if (!saved) return null

    try {
      const state: PersistedState = JSON.parse(saved)

      // Check if state is too old
      if (Date.now() - state.timestamp > MAX_AGE) {
        sessionStorage.removeItem(FORM_STATE_KEY)
        return null
      }

      sessionStorage.removeItem(FORM_STATE_KEY)
      return {
        formData: state.formData,
        stepId: state.currentStepId,
      }
    } catch {
      sessionStorage.removeItem(FORM_STATE_KEY)
      return null
    }
  }, [])

  const clearFormState = useCallback(() => {
    sessionStorage.removeItem(FORM_STATE_KEY)
  }, [])

  return { saveFormState, restoreFormState, clearFormState }
}
