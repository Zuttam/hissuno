'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createProject } from '@/lib/projects/client'
import { createClient } from '@/lib/supabase/client'
import {
  filterFilesForUpload,
  selectGitignore,
  summarizeFiles,
  type GitignoreSelection,
} from '@/lib/projects/source-code-utils'
import type { CodebaseMode, StepId } from '../shared/types'
import type { GitHubRepoSelection } from '../shared/github-repo-picker'
import { ProjectDetailsCard } from './project-details-card'
import { SourceCodeCard } from '../shared/source-code-card'
import { KnowledgeSourcesCard, type KnowledgeSourceInput } from './knowledge-sources-card'
import {
  WizardContainer,
  WizardStep,
  WizardNavigation,
  type WizardStepMetadata,
} from '@/components/ui'
import { canProceedToNextStep } from './validation'

const FORM_STATE_KEY = 'project-create-form-state'

type PersistedFormState = {
  name: string
  description: string
  codebaseMode: CodebaseMode
  currentStep: number
}

export function ProjectCreateForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [codebaseMode, setCodebaseMode] = useState<CodebaseMode>('upload-folder')
  const [codebaseFiles, setCodebaseFiles] = useState<File[]>([])
  const [explicitGitignore, setExplicitGitignore] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'creating' | 'redirecting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [codebaseError, setCodebaseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const gitignoreInputRef = useRef<HTMLInputElement | null>(null)

  // GitHub integration state
  const [hasGitHubIntegration, setHasGitHubIntegration] = useState(false)
  const [isCheckingGitHub, setIsCheckingGitHub] = useState(true)
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepoSelection | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)

  // Knowledge sources state
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceInput[]>([])
  const [skipKnowledgeAnalysis, setSkipKnowledgeAnalysis] = useState(false)

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Check GitHub integration status on mount
  const checkGitHubIntegration = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/github')
      if (response.ok) {
        const data = await response.json()
        setHasGitHubIntegration(data.connected)
      }
    } catch (err) {
      console.error('Failed to check GitHub integration:', err)
    } finally {
      setIsCheckingGitHub(false)
    }
  }, [])

  // Restore form state from sessionStorage after OAuth redirect
  useEffect(() => {
    const restored = searchParams.get('restored')
    if (restored === 'true') {
      const savedState = sessionStorage.getItem(FORM_STATE_KEY)
      if (savedState) {
        try {
          const parsed: PersistedFormState = JSON.parse(savedState)
          setName(parsed.name)
          setDescription(parsed.description)
          setCodebaseMode(parsed.codebaseMode)
          setCurrentStep(parsed.currentStep)
          sessionStorage.removeItem(FORM_STATE_KEY)
        } catch (err) {
          console.error('Failed to restore form state:', err)
        }
      }
      // Clean up URL
      router.replace('/projects/new', { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    void checkGitHubIntegration()
  }, [checkGitHubIntegration])

  // Save form state before OAuth redirect
  const saveFormState = useCallback(() => {
    const state: PersistedFormState = {
      name,
      description,
      codebaseMode,
      currentStep,
    }
    sessionStorage.setItem(FORM_STATE_KEY, JSON.stringify(state))
  }, [name, description, codebaseMode, currentStep])

  const handleConnectGitHub = async () => {
    setIsConnectingGitHub(true)
    saveFormState()

    try {
      const supabase = createClient()
      
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/projects/new?restored=true`,
          scopes: 'user:email read:user repo',
        },
      })

      if (linkError) {
        console.error('Failed to connect GitHub:', linkError)
        setCodebaseError(linkError.message)
        setIsConnectingGitHub(false)
      }
      // User will be redirected to GitHub
    } catch (err) {
      console.error('Failed to connect GitHub:', err)
      setCodebaseError(err instanceof Error ? err.message : 'Failed to connect GitHub')
      setIsConnectingGitHub(false)
    }
  }

  const enableDirectorySelection = (input: HTMLInputElement) => {
    input.multiple = true
    if (!input.hasAttribute('webkitdirectory')) {
      input.setAttribute('webkitdirectory', '')
    }
    if (!input.hasAttribute('directory')) {
      input.setAttribute('directory', '')
    }
  }

  const handleSelectFolderClick = () => {
    const input = fileInputRef.current
    if (!input) return
    enableDirectorySelection(input)
    input.click()
  }

  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files
    if (!list || list.length === 0) {
      event.target.value = ''
      return
    }

    const files = Array.from(list)
    setCodebaseFiles(files)
    setExplicitGitignore(null)
    setCodebaseError(null)

    event.target.value = ''
  }

  const handleSelectGitignoreClick = () => {
    gitignoreInputRef.current?.click()
  }

  const handleGitignoreChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setExplicitGitignore(file)
      setCodebaseError(null)
    }
    event.target.value = ''
  }

  const clearGitignoreSelection = () => {
    setExplicitGitignore(null)
    if (gitignoreInputRef.current) {
      gitignoreInputRef.current.value = ''
    }
  }

  const resetFolderSelection = () => {
    setCodebaseFiles([])
    setExplicitGitignore(null)
    setCodebaseError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (gitignoreInputRef.current) {
      gitignoreInputRef.current.value = ''
    }
  }

  const handleCodebaseModeChange = (nextMode: CodebaseMode) => {
    setCodebaseMode(nextMode)
    setCodebaseError(null)
    if (nextMode !== 'upload-folder') {
      resetFolderSelection()
    }
    if (nextMode !== 'github') {
      setSelectedRepo(null)
      setSelectedBranch(null)
    }
  }

  const folderSummary = useMemo(() => summarizeFiles(codebaseFiles), [codebaseFiles])
  const gitignoreSelection = useMemo<GitignoreSelection | null>(
    () => selectGitignore(codebaseFiles, explicitGitignore),
    [codebaseFiles, explicitGitignore]
  )

  // Check if source code step should show "Link Later"
  const hasSourceCode = codebaseFiles.length > 0 || (selectedRepo && selectedBranch)

  // Compute wizard steps
  const wizardSteps = useMemo<WizardStepMetadata[]>(() => {
    return [
      { id: 'metadata', title: 'Project Details', number: 1 },
      { id: 'source-code', title: 'Source Code', number: 2 },
      { id: 'knowledge-sources', title: 'Knowledge Sources', number: 3 },
    ]
  }, [])

  const totalSteps = wizardSteps.length
  const currentStepId: StepId = (wizardSteps[currentStep - 1]?.id ?? 'metadata') as StepId

  const handleNext = () => {
    setValidationError(null)
    setCodebaseError(null)

    const formState = {
      name,
      codebaseMode,
      codebaseFiles,
      githubRepo: selectedRepo,
      githubBranch: selectedBranch,
    }

    const validation = canProceedToNextStep(currentStepId, formState)

    if (!validation.isValid) {
      setValidationError(validation.error ?? 'Please fix the errors before proceeding')
      return
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    setValidationError(null)
    setCodebaseError(null)

    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmitForm = async () => {
    setValidationError(null)
    await handleSubmit()
  }

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault()
    }
    if (isSubmitting) return

    setIsSubmitting(true)
    setPhase('preparing')
    setError(null)
    setCodebaseError(null)

    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      if (description.trim()) formData.append('description', description.trim())

      if (codebaseMode === 'github' && selectedRepo && selectedBranch) {
        // GitHub source code
        formData.append('codebaseSource', 'github')
        formData.append('repositoryUrl', `https://github.com/${selectedRepo.fullName}`)
        formData.append('repositoryBranch', selectedBranch)
      } else if (codebaseFiles.length > 0) {
        // Upload folder source code
        formData.append('codebaseSource', 'upload-folder')

        const { kept } = await filterFilesForUpload(codebaseFiles, gitignoreSelection)

        if (kept.length === 0) {
          setCodebaseError('All files were ignored by .gitignore. Add files or adjust the rules.')
          setIsSubmitting(false)
          setPhase('idle')
          return
        }

        kept.forEach(({ file, relativePath }) => {
          const uploadName = relativePath || file.name
          formData.append('codebase', file, uploadName)
        })

        const gitignoreEntry = gitignoreSelection?.file
          ? kept.find((entry) => entry.file === gitignoreSelection.file) ?? null
          : null

        if (gitignoreEntry) {
          const uploadName = gitignoreEntry.relativePath || gitignoreEntry.file.name
          formData.append('gitignore', gitignoreEntry.file, uploadName)
        }
      } else {
        formData.append('codebaseSource', 'none')
      }

      setPhase('creating')
      const payload = await createProject(formData)

      setPhase('redirecting')
      const projectId: string | undefined = payload?.project?.id
      if (projectId) {
        router.push(`/projects/${projectId}`)
      } else {
        router.push('/projects')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project.'
      setError(message)
      setIsSubmitting(false)
      setPhase('idle')
      return
    }
  }

  // Determine the next button label for the source code step
  const getNextLabel = () => {
    if (currentStepId === 'source-code' && !hasSourceCode) {
      return 'Link Later'
    }
    return 'Next'
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <WizardContainer currentStep={currentStep} steps={wizardSteps}>
        <WizardStep stepNumber={1} currentStep={currentStep}>
          <ProjectDetailsCard
            name={name}
            description={description}
            onNameChange={setName}
            onDescriptionChange={setDescription}
          />
        </WizardStep>

        <WizardStep stepNumber={2} currentStep={currentStep}>
          <SourceCodeCard
            uploadProps={{
              codebaseMode,
              onCodebaseModeChange: handleCodebaseModeChange,
              folderSummary,
              gitignoreSelection,
              fileInputRef,
              gitignoreInputRef,
              onSelectFolderClick: handleSelectFolderClick,
              onFolderChange: handleFolderChange,
              onSelectGitignoreClick: handleSelectGitignoreClick,
              onGitignoreChange: handleGitignoreChange,
              onClearGitignoreSelection: clearGitignoreSelection,
              onResetFolderSelection: resetFolderSelection,
            }}
            githubProps={{
              selectedRepo,
              selectedBranch,
              onRepoChange: setSelectedRepo,
              onBranchChange: setSelectedBranch,
              hasGitHubIntegration,
              onConnectGitHub: handleConnectGitHub,
              isConnecting: isConnectingGitHub,
            }}
            codebaseError={codebaseError}
          />
        </WizardStep>

        <WizardStep stepNumber={3} currentStep={currentStep}>
          <KnowledgeSourcesCard
            sources={knowledgeSources}
            onSourcesChange={setKnowledgeSources}
            skipAnalysis={skipKnowledgeAnalysis}
            onSkipAnalysisChange={setSkipKnowledgeAnalysis}
          />
        </WizardStep>

        <WizardNavigation
          currentStep={currentStep}
          totalSteps={totalSteps}
          canGoNext={true}
          canGoPrevious={true}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onSubmit={handleSubmitForm}
          isSubmitting={isSubmitting}
          submitLabel="Create project"
          submittingLabel={
            phase === 'preparing'
              ? 'Preparing submission…'
              : phase === 'creating'
                ? 'Creating project…'
                : 'Redirecting…'
          }
          nextLabel={getNextLabel()}
          validationError={validationError ?? error ?? undefined}
        />
      </WizardContainer>
    </form>
  )
}
