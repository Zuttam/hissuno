'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { updateProject, rotateKeys } from '@/lib/projects/client'
import {
  Alert,
  Button,
  SectionHeader,
  Tabs,
  TabsList,
  Tab,
  TabsPanel,
} from '@/components/ui'

import { GeneralTabPanel } from './GeneralTabPanel'
import { CodebaseTabPanel } from './CodebaseTabPanel'
import { PmAgentTabPanel, type ProjectSettings } from './PmAgentTabPanel'
import { SupportAgentTabPanel } from './SupportAgentTabPanel'
import { KeysTabPanel } from './KeysTabPanel'

interface EditProjectDialogProps {
  project: ProjectWithCodebase & {
    public_key?: string | null
    secret_key?: string | null
    allowed_origins?: string[] | null
  }
  onClose: () => void
  onSaved: () => Promise<void>
}

type BranchOption = {
  name: string
  sha: string
  protected: boolean
}

const DEFAULT_SETTINGS: ProjectSettings = {
  issue_tracking_enabled: true,
  issue_spec_threshold: 3,
  spec_guidelines: null,
}

export function EditProjectDialog({ project, onClose, onSaved }: EditProjectDialogProps) {
  const [activeTab, setActiveTab] = useState('general')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // General settings
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')

  // Source code settings
  const [analysisScope, setAnalysisScope] = useState(project.source_code?.analysis_scope ?? '')
  const isGitHubSource = project.source_code?.kind === 'github'
  const [repositoryBranch, setRepositoryBranch] = useState(project.source_code?.repository_branch ?? '')
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)

  // PM Agent settings
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS)
  const [originalSettings, setOriginalSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  // Support Agent settings
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>(project.allowed_origins ?? [])

  // Keys state
  const [isRotating, setIsRotating] = useState<'public' | 'secret' | 'both' | null>(null)
  const [currentPublicKey, setCurrentPublicKey] = useState(project.public_key ?? '')
  const [currentSecretKey, setCurrentSecretKey] = useState(project.secret_key ?? '')

  // Parse owner/repo from repository URL
  const parseRepoInfo = useCallback(() => {
    const url = project.source_code?.repository_url
    if (!url) return null
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) return null
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
  }, [project.source_code?.repository_url])

  // Fetch branches for the repository
  const fetchBranches = useCallback(async () => {
    const repoInfo = parseRepoInfo()
    if (!repoInfo) return

    setIsLoadingBranches(true)
    try {
      const response = await fetch(`/api/integrations/github/repos/${repoInfo.owner}/${repoInfo.repo}/branches`)
      if (response.ok) {
        const data = await response.json()
        setBranches(data.branches || [])
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err)
    } finally {
      setIsLoadingBranches(false)
    }
  }, [parseRepoInfo])

  // Fetch PM Agent settings
  const fetchSettings = useCallback(async () => {
    setIsLoadingSettings(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/settings`)
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          const fetchedSettings = {
            issue_tracking_enabled: data.settings.issue_tracking_enabled ?? DEFAULT_SETTINGS.issue_tracking_enabled,
            issue_spec_threshold: data.settings.issue_spec_threshold ?? DEFAULT_SETTINGS.issue_spec_threshold,
            spec_guidelines: data.settings.spec_guidelines ?? null,
          }
          setSettings(fetchedSettings)
          setOriginalSettings(fetchedSettings)
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setIsLoadingSettings(false)
    }
  }, [project.id])

  useEffect(() => {
    if (isGitHubSource) {
      void fetchBranches()
    }
    void fetchSettings()
  }, [isGitHubSource, fetchBranches, fetchSettings])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const projectPayload: Record<string, unknown> = {}
      const settingsPayload: Record<string, unknown> = {}

      // General updates
      if (name !== project.name) {
        projectPayload.name = name
      }
      const trimmedDescription = description.trim()
      if ((project.description ?? '') !== trimmedDescription) {
        projectPayload.description = trimmedDescription
      }

      // Source code updates
      if (isGitHubSource && repositoryBranch !== project.source_code?.repository_branch) {
        projectPayload.repositoryBranch = repositoryBranch
      }
      const currentScope = project.source_code?.analysis_scope ?? ''
      const trimmedScope = analysisScope.trim()
      if (trimmedScope !== currentScope) {
        projectPayload.analysisScope = trimmedScope || null
      }

      // Allowed origins
      const originsChanged = JSON.stringify(allowedOrigins) !== JSON.stringify(project.allowed_origins ?? [])
      if (originsChanged) {
        projectPayload.allowed_origins = allowedOrigins.length > 0 ? allowedOrigins : null
      }

      // PM Agent settings - compare against original fetched values
      if (settings.issue_tracking_enabled !== originalSettings.issue_tracking_enabled) {
        settingsPayload.issue_tracking_enabled = settings.issue_tracking_enabled
      }
      if (settings.issue_spec_threshold !== originalSettings.issue_spec_threshold) {
        settingsPayload.issue_spec_threshold = settings.issue_spec_threshold
      }
      if (settings.spec_guidelines !== originalSettings.spec_guidelines) {
        settingsPayload.spec_guidelines = settings.spec_guidelines
      }

      // Update project if there are changes
      if (Object.keys(projectPayload).length > 0) {
        await updateProject(project.id, projectPayload)
      }

      // Update settings if there are changes
      if (Object.keys(settingsPayload).length > 0) {
        await fetch(`/api/projects/${project.id}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsPayload),
        })
      }

      await onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update project.'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRotateKeys = async (keyType: 'public' | 'secret' | 'both') => {
    setIsRotating(keyType)
    setError(null)
    setSuccessMessage(null)

    try {
      const result = await rotateKeys(project.id, keyType)
      if (result.project) {
        setCurrentPublicKey(result.project.public_key ?? '')
        setCurrentSecretKey(result.project.secret_key ?? '')
      }
      setSuccessMessage(`Successfully rotated ${keyType === 'both' ? 'both keys' : `${keyType} key`}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rotate keys.'
      setError(message)
    } finally {
      setIsRotating(null)
    }
  }

  const repoInfo = parseRepoInfo()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col w-full max-w-2xl max-h-[90vh] mb-[5vh] rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="px-8 pt-8 pb-4">
          <SectionHeader
            title="Edit project"
            description="Update your project settings across different categories."
          />
        </div>

        <Tabs value={activeTab} onChange={setActiveTab} className="flex-1 overflow-hidden min-h-0">
          <TabsList className="border-b-0 px-8 shrink-0">
            <Tab value="general">General</Tab>
            <Tab value="codebase">Codebase</Tab>
            <Tab value="pm-agent">PM Agent</Tab>
            <Tab value="support-agent">Support Agent</Tab>
            <Tab value="keys">Keys</Tab>
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-[300px]">
            <TabsPanel value="general" className="px-8 py-6">
              <GeneralTabPanel
                name={name}
                setName={setName}
                description={description}
                setDescription={setDescription}
              />
            </TabsPanel>

            <TabsPanel value="codebase" className="px-8 py-6">
              <CodebaseTabPanel
                sourceCode={project.source_code}
                isGitHubSource={isGitHubSource}
                repoInfo={repoInfo}
                repositoryBranch={repositoryBranch}
                setRepositoryBranch={setRepositoryBranch}
                branches={branches}
                isLoadingBranches={isLoadingBranches}
                analysisScope={analysisScope}
                setAnalysisScope={setAnalysisScope}
              />
            </TabsPanel>

            <TabsPanel value="pm-agent" className="px-8 py-6">
              <PmAgentTabPanel
                settings={settings}
                setSettings={setSettings}
                isLoadingSettings={isLoadingSettings}
              />
            </TabsPanel>

            <TabsPanel value="support-agent" className="px-8 py-6">
              <SupportAgentTabPanel
                allowedOrigins={allowedOrigins}
                setAllowedOrigins={setAllowedOrigins}
              />
            </TabsPanel>

            <TabsPanel value="keys" className="px-8 py-6">
              <KeysTabPanel
                publicKey={currentPublicKey}
                secretKey={currentSecretKey}
                isRotating={isRotating}
                onRotateKeys={handleRotateKeys}
              />
            </TabsPanel>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-8 py-4 shrink-0">
          {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
          {successMessage && <Alert variant="success" className="mb-4">{successMessage}</Alert>}

          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSaving}
            >
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
