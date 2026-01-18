'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createProject, updateProject } from '@/lib/projects/client'
import {
  WizardContainer,
  WizardStep,
  type WizardStepMetadata,
} from '@/components/ui'
import {
  getStepsForFlow,
  getStepIndex,
  DEFAULT_FORM_DATA,
  type ProjectWizardMode,
  type ProjectStepId,
  type ProjectWizardContext,
  type ProjectWizardFormData,
} from '@/components/projects/shared/wizard/steps'
import { useFormPersistence } from './use-form-persistence'
import { useIntegrations } from './use-integrations'

export interface ProjectWizardProps {
  mode: ProjectWizardMode
  projectId?: string
  initialData?: Partial<ProjectWizardFormData>
}

export function ProjectWizard({
  mode,
  projectId,
  initialData,
}: ProjectWizardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Form state
  const [formData, setFormData] = useState<ProjectWizardFormData>(() => ({
    ...DEFAULT_FORM_DATA,
    ...initialData,
  }))

  // Wizard navigation state
  const steps = useMemo(() => getStepsForFlow(mode), [mode])

  // Initialize step from URL if present (only on mount)
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    const stepParam = searchParams.get('step') as ProjectStepId | null
    if (stepParam) {
      const index = getStepIndex(stepParam, mode)
      if (index >= 0) return index
    }
    return 0
  })
  const currentStepId: ProjectStepId = (steps[currentStepIndex]?.id ?? 'project-details') as ProjectStepId

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'saving' | 'redirecting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Form persistence for OAuth redirects
  const { saveFormState, restoreFormState, clearFormState } = useFormPersistence({
    formData,
    currentStepId,
  })

  // Clear codebase form data when GitHub is disconnected
  const handleGitHubDisconnect = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      codebase: {
        source: 'none',
        repositoryUrl: undefined,
        repositoryBranch: undefined,
        fullName: undefined,
        analysisScope: undefined,
      },
    }))
  }, [])

  // Integration handlers
  const integrations = useIntegrations({
    mode,
    projectId,
    currentStepId,
    onBeforeOAuth: saveFormState,
    onGitHubDisconnect: handleGitHubDisconnect,
  })

  // Update URL when step changes
  useEffect(() => {
    const basePath = mode === 'edit' && projectId
      ? `/projects/${projectId}/edit`
      : '/projects/new'
    const newUrl = `${basePath}?step=${currentStepId}`
    router.replace(newUrl, { scroll: false })
  }, [currentStepId, mode, projectId, router])

  // Handle restored state from OAuth redirect
  useEffect(() => {
    const restored = searchParams.get('restored')
    const stepParam = searchParams.get('step') as ProjectStepId | null

    if (restored === 'true') {
      const restoredState = restoreFormState()
      if (restoredState) {
        setFormData(restoredState.formData)

        // Use step from URL param if provided, otherwise from persisted state
        const targetStep = stepParam || restoredState.stepId
        const stepIndex = getStepIndex(targetStep, mode)
        if (stepIndex >= 0) {
          setCurrentStepIndex(stepIndex)
        }
      }

      // Clean up restored param but keep step
      const basePath = mode === 'edit' && projectId
        ? `/projects/${projectId}/edit`
        : '/projects/new'
      const cleanUrl = stepParam ? `${basePath}?step=${stepParam}` : basePath
      router.replace(cleanUrl, { scroll: false })
    }
  }, [searchParams, router, mode, projectId, restoreFormState])

  // Build wizard context
  const context: ProjectWizardContext = useMemo(
    () => ({
      formData,
      setFormData,
      mode,
      projectId,
      integrations,
    }),
    [formData, mode, projectId, integrations]
  )

  // Navigation handlers
  const handleNext = useCallback(() => {
    const currentStep = steps[currentStepIndex]
    const validation = currentStep.validate(formData)

    if (!validation.isValid) {
      setError(validation.error ?? 'Please fix errors before proceeding')
      return
    }

    setError(null)
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
    }
  }, [currentStepIndex, steps, formData])

  const handlePrevious = useCallback(() => {
    setError(null)
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
    }
  }, [currentStepIndex])

  const handleCancel = useCallback(() => {
    clearFormState()
    if (mode === 'edit' && projectId) {
      router.push(`/projects/${projectId}`)
    } else {
      router.push('/projects')
    }
  }, [mode, projectId, router, clearFormState])

  const handleClose = useCallback(() => {
    router.push(`/projects/${projectId}`)
  }, [projectId, router])

  const handleStepClick = useCallback((stepNumber: number) => {
    setError(null)
    // stepNumber is 1-indexed, convert to 0-indexed
    const targetIndex = stepNumber - 1
    if (targetIndex >= 0 && targetIndex < steps.length) {
      setCurrentStepIndex(targetIndex)
    }
  }, [steps.length])

  const handleSubmit = useCallback(async () => {
    // Validate all steps
    for (const step of steps) {
      const validation = step.validate(formData)
      if (!validation.isValid) {
        setError(`${step.title}: ${validation.error}`)
        return
      }
    }

    setIsSubmitting(true)
    setPhase('preparing')
    setError(null)

    try {
      if (mode === 'create') {
        // Build FormData for create
        const payload = new FormData()
        payload.append('name', formData.name.trim())
        if (formData.description.trim()) {
          payload.append('description', formData.description.trim())
        }

        // Codebase
        if (formData.codebase.source === 'github' && formData.codebase.repositoryUrl) {
          payload.append('codebaseSource', 'github')
          payload.append('repositoryUrl', formData.codebase.repositoryUrl)
          if (formData.codebase.repositoryBranch) {
            payload.append('repositoryBranch', formData.codebase.repositoryBranch)
          }
        } else {
          payload.append('codebaseSource', 'none')
        }

        // Knowledge sources
        if (formData.codebase.analysisScope?.trim()) {
          payload.append('analysisScope', formData.codebase.analysisScope.trim())
        }

        if (formData.knowledgeSources.length > 0) {
          const sourcesToSend = formData.knowledgeSources
            .filter((s) => s.type !== 'uploaded_doc')
            .map((s) => ({
              type: s.type,
              url: s.url,
              content: s.content,
            }))
          if (sourcesToSend.length > 0) {
            payload.append('knowledgeSources', JSON.stringify(sourcesToSend))
          }
        }

        // Widget settings
        payload.append('widgetVariant', formData.widget.variant)
        payload.append('widgetTheme', formData.widget.theme)
        payload.append('widgetPosition', formData.widget.position)
        payload.append('widgetTitle', formData.widget.title)
        payload.append('widgetInitialMessage', formData.widget.initialMessage)
        payload.append('widgetTokenRequired', formData.widget.tokenRequired ? 'true' : 'false')
        if (formData.widget.allowedOrigins.length > 0) {
          payload.append('allowedOrigins', JSON.stringify(formData.widget.allowedOrigins))
        }
        payload.append('sessionIdleTimeoutMinutes', String(formData.widget.idleTimeoutMinutes))
        payload.append('sessionGoodbyeDelaySeconds', String(formData.widget.goodbyeDelaySeconds))
        payload.append('sessionIdleResponseTimeoutSeconds', String(formData.widget.idleResponseTimeoutSeconds))

        // Issues settings
        payload.append('issueTrackingEnabled', formData.issues.trackingEnabled ? 'true' : 'false')
        payload.append('issueSpecThreshold', String(formData.issues.specThreshold))
        if (formData.issues.specGuidelines) {
          payload.append('specGuidelines', formData.issues.specGuidelines)
        }
        payload.append('autoSessionTracking', formData.issues.autoSessionTracking ? 'true' : 'false')

        setPhase('saving')
        const result = await createProject(payload)
        clearFormState()

        setPhase('redirecting')
        router.push(`/projects/${result.project.id}`)
      } else {
        // Edit mode - use PATCH endpoints
        setPhase('saving')

        // Update project details
        await updateProject(projectId!, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        })

        // Update widget settings
        await fetch(`/api/projects/${projectId}/settings/widget`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            widget_variant: formData.widget.variant,
            widget_theme: formData.widget.theme,
            widget_position: formData.widget.position,
            widget_title: formData.widget.title,
            widget_initial_message: formData.widget.initialMessage,
            allowed_origins: formData.widget.allowedOrigins,
            widget_token_required: formData.widget.tokenRequired,
          }),
        })

        // Update session lifecycle settings
        await fetch(`/api/projects/${projectId}/settings/sessions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_idle_timeout_minutes: formData.widget.idleTimeoutMinutes,
            session_goodbye_delay_seconds: formData.widget.goodbyeDelaySeconds,
            session_idle_response_timeout_seconds: formData.widget.idleResponseTimeoutSeconds,
          }),
        })

        // Update issue tracking settings
        await fetch(`/api/projects/${projectId}/settings/issues`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issue_tracking_enabled: formData.issues.trackingEnabled,
            issue_spec_threshold: formData.issues.specThreshold,
            spec_guidelines: formData.issues.specGuidelines,
          }),
        })

        // Handle codebase changes (only if GitHub is actually connected)
        if (integrations.github.isConnected && formData.codebase.source === 'github' && formData.codebase.repositoryUrl) {
          // Check if codebase source already exists
          const sourcesResponse = await fetch(`/api/projects/${projectId}/knowledge-sources`)
          const { sources } = sourcesResponse.ok ? await sourcesResponse.json() : { sources: [] }
          const codebaseSource = sources?.find((s: { type: string }) => s.type === 'codebase')

          const codebasePayload = {
            repositoryUrl: formData.codebase.repositoryUrl,
            repositoryBranch: formData.codebase.repositoryBranch || 'main',
            analysis_scope: formData.codebase.analysisScope?.trim() || null,
          }

          let codebaseResponse: Response
          if (codebaseSource) {
            // Update existing codebase via PATCH
            codebaseResponse = await fetch(
              `/api/projects/${projectId}/knowledge-sources?sourceId=${codebaseSource.id}`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(codebasePayload),
              }
            )
          } else {
            // Create new codebase via POST
            codebaseResponse = await fetch(`/api/projects/${projectId}/knowledge-sources`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'codebase',
                ...codebasePayload,
              }),
            })
          }

          if (!codebaseResponse.ok) {
            const errorData = await codebaseResponse.json()
            throw new Error(errorData.error || 'Failed to save codebase')
          }
        }

        // Handle knowledge sources (non-codebase)
        // Fetch current sources from DB to determine what to add/delete
        const currentSourcesResponse = await fetch(`/api/projects/${projectId}/knowledge-sources`)
        if (currentSourcesResponse.ok) {
          const { sources: dbSources } = await currentSourcesResponse.json()
          const existingNonCodebaseSources = (dbSources ?? []).filter(
            (s: { type: string }) => s.type !== 'codebase'
          )

          // Get IDs of sources currently in DB
          const existingIds = new Set(existingNonCodebaseSources.map((s: { id: string }) => s.id))

          // Get IDs of sources in form data (only those with valid UUIDs are existing)
          const formSourceIds = new Set(
            formData.knowledgeSources
              .filter((s) => s.id.match(/^[0-9a-f-]{36}$/i))
              .map((s) => s.id)
          )

          // Delete sources that were removed
          for (const dbSource of existingNonCodebaseSources) {
            if (!formSourceIds.has(dbSource.id)) {
              await fetch(
                `/api/projects/${projectId}/knowledge-sources?sourceId=${dbSource.id}`,
                { method: 'DELETE' }
              )
            }
          }

          // Add new sources (those without valid UUID - generated client-side)
          for (const source of formData.knowledgeSources) {
            if (!existingIds.has(source.id)) {
              await fetch(`/api/projects/${projectId}/knowledge-sources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: source.type,
                  url: source.url,
                  content: source.content,
                }),
              })
            }
          }
        }

        clearFormState()

        // In edit mode, show success feedback instead of redirecting
        setIsSubmitting(false)
        setPhase('idle')
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save project'
      setError(message)
      setIsSubmitting(false)
      setPhase('idle')
    }
  }, [mode, projectId, formData, steps, router, clearFormState, integrations])

  // Convert to wizard step metadata format
  const wizardSteps: WizardStepMetadata[] = useMemo(
    () =>
      steps.map((step, idx) => ({
        id: step.id,
        title: step.shortTitle ?? step.title,
        number: idx + 1,
      })),
    [steps]
  )

  // Get button labels
  const submitLabel = mode === 'create' ? 'Create Project' : 'Save Changes'
  const submittingLabel =
    phase === 'preparing'
      ? 'Preparing...'
      : phase === 'saving'
        ? mode === 'create'
          ? 'Creating...'
          : 'Saving...'
        : 'Redirecting...'

 

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <WizardContainer
        currentStep={currentStepIndex + 1}
        steps={wizardSteps}
        mode={mode}
        // Create mode props
        onPrevious={handlePrevious}
        onNext={handleNext}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onStepClick={handleStepClick}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
        submittingLabel={submittingLabel}
        validationError={error ?? undefined}
        // Edit mode props
        onSave={handleSubmit}
        onClose={handleClose}
        saveSuccess={saveSuccess}
      >
        {steps.map((step, idx) => (
          <WizardStep
            key={step.id}
            stepNumber={idx + 1}
            currentStep={currentStepIndex + 1}
          >
            <step.component
              context={context}
              title={step.title}
              description={step.description}
            />
          </WizardStep>
        ))}
      </WizardContainer>
    </form>
  )
}
