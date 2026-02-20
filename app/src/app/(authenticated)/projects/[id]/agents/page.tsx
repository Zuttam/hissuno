'use client'

import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useProject } from '@/components/providers/project-provider'
import { useIntegrationStatuses } from '@/hooks/use-integration-statuses'
import { TestAgentDialog } from '@/components/projects/test-agent-dialog'
import { KnowledgeSourcesList } from '@/components/projects/knowledge/knowledge-sources-list'
import { KnowledgeSourcesDialog } from '@/components/projects/edit-dialogs/knowledge-sources-dialog'
import { AgentCard, buildSupportChannels, buildPmSources, buildPmDestinations } from '@/components/projects/agents/agent-card'
import { SupportAgentDialog } from '@/components/projects/agents/support-agent-dialog'
import { PmAgentDialog } from '@/components/projects/agents/pm-agent-dialog'
import { KnowledgeDetailDialog } from '@/components/projects/agents/knowledge-detail-dialog'
import { ProjectInfoSection } from '@/components/projects/edit-dialogs/project-details-dialog'
import { CustomTagsSection, type LocalCustomTag } from '@/components/projects/edit-dialogs/sessions-settings-dialog'
import { TrackingToggle, type IssuesSettings } from '@/components/projects/edit-dialogs/issues-settings-dialog'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, Tab, TabsPanel } from '@/components/ui/tabs'
import { Button, Heading, Spinner, PageHeader, Badge } from '@/components/ui'
import { formatRelativeTime } from '@/lib/utils/format-time'
import type { KnowledgeSourceRecord, NamedPackageWithSources } from '@/lib/knowledge/types'

const VALID_TABS = ['general', 'knowledge', 'agents', 'feedback', 'issues'] as const
type SettingsTab = (typeof VALID_TABS)[number]

const MAX_TAGS = 10

interface AgentSettings {
  supportAgent: {
    toneOfVoice: string
    brandGuidelines: string
    packageId: string | null
  }
  pmAgent: {
    classificationGuidelines: string
    specGuidelines: string
    analysisGuidelines: string
  }
}

const DEFAULT_SETTINGS: AgentSettings = {
  supportAgent: {
    toneOfVoice: 'professional',
    brandGuidelines: '',
    packageId: null,
  },
  pmAgent: {
    classificationGuidelines: '',
    specGuidelines: '',
    analysisGuidelines: '',
  },
}

export default function AgentsSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading: isLoadingProject, refreshProject, refreshProjects } = useProject()
  const { statuses: integrationStatuses } = useIntegrationStatuses(projectId)

  // Active tab from URL
  const tabParam = searchParams.get('tab') as SettingsTab | null
  const activeTab: SettingsTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'general'

  const handleTabChange = useCallback((value: string) => {
    router.replace(`/projects/${projectId}/agents?tab=${value}`)
  }, [router, projectId])

  // --- Agent dialog visibility ---
  const [showSupportDialog, setShowSupportDialog] = useState(false)
  const [showPmDialog, setShowPmDialog] = useState(false)
  const [showTestAgent, setShowTestAgent] = useState(false)
  const [showSourcesDialog, setShowSourcesDialog] = useState(false)
  const [showKnowledgeDetail, setShowKnowledgeDetail] = useState(false)

  // --- Agent data ---
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [sources, setSources] = useState<KnowledgeSourceRecord[]>([])
  const [isLoadingSources, setIsLoadingSources] = useState(true)
  const [packages, setPackages] = useState<NamedPackageWithSources[]>([])

  // --- General tab state ---
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isSavingGeneral, setIsSavingGeneral] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [generalSaved, setGeneralSaved] = useState(false)

  // --- Feedback tab state ---
  const [customTags, setCustomTags] = useState<LocalCustomTag[]>([])
  const [isLoadingTags, setIsLoadingTags] = useState(true)
  const [isSavingTags, setIsSavingTags] = useState(false)
  const [tagsError, setTagsError] = useState<string | null>(null)
  const [tagsSaved, setTagsSaved] = useState(false)

  // --- Issues tab state ---
  const [issuesSettings, setIssuesSettings] = useState<IssuesSettings>({ issue_tracking_enabled: true })
  const [isLoadingIssues, setIsLoadingIssues] = useState(true)
  const [isSavingIssues, setIsSavingIssues] = useState(false)
  const [issuesError, setIssuesError] = useState<string | null>(null)
  const [issuesSaved, setIssuesSaved] = useState(false)

  // Initialize general tab fields from project
  useEffect(() => {
    if (project) {
      setProjectName(project.name)
      setProjectDescription(project.description || '')
    }
  }, [project])

  // --- Agent data fetchers ---
  const fetchSettings = useCallback(async () => {
    if (!projectId) return
    try {
      const [settingsRes, supportAgentRes, pmAgentRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/settings`),
        fetch(`/api/projects/${projectId}/settings/support-agent`),
        fetch(`/api/projects/${projectId}/settings/pm-agent`),
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        if (data.settings) {
          setSettings((prev) => ({
            ...prev,
            supportAgent: {
              ...prev.supportAgent,
              toneOfVoice: data.settings.support_agent_tone ?? 'professional',
              brandGuidelines: data.settings.brand_guidelines ?? '',
            },
          }))
        }
      }

      if (supportAgentRes.ok) {
        const data = await supportAgentRes.json()
        if (data.settings) {
          setSettings((prev) => ({
            ...prev,
            supportAgent: {
              ...prev.supportAgent,
              packageId: data.settings.support_agent_package_id ?? null,
            },
          }))
        }
      }

      if (pmAgentRes.ok) {
        const data = await pmAgentRes.json()
        if (data.settings) {
          setSettings((prev) => ({
            ...prev,
            pmAgent: {
              classificationGuidelines: data.settings.classification_guidelines ?? '',
              specGuidelines: data.settings.spec_guidelines ?? '',
              analysisGuidelines: data.settings.analysis_guidelines ?? '',
            },
          }))
        }
      }
    } catch (err) {
      console.error('[agents] Failed to fetch settings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  const fetchSources = useCallback(async () => {
    if (!projectId) return
    setIsLoadingSources(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/knowledge-sources`)
      if (response.ok) {
        const data = await response.json()
        setSources(data.sources ?? [])
      }
    } catch (err) {
      console.error('[agents] Failed to fetch sources:', err)
    } finally {
      setIsLoadingSources(false)
    }
  }, [projectId])

  const fetchPackages = useCallback(async () => {
    if (!projectId) return
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/packages`)
      if (response.ok) {
        const data = await response.json()
        setPackages(data.packages ?? [])
      }
    } catch (err) {
      console.error('[agents] Failed to fetch packages:', err)
    }
  }, [projectId])

  // --- Feedback tab fetcher ---
  const fetchCustomTags = useCallback(async () => {
    if (!projectId) return
    setIsLoadingTags(true)
    setTagsError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/custom-tags`)
      if (!response.ok) throw new Error('Failed to load custom tags')
      const data = await response.json()
      if (data.tags) {
        setCustomTags(data.tags.map((tag: { id: string; name: string; slug: string; description: string; color: string; position: number }) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          description: tag.description,
          color: tag.color,
          position: tag.position,
        })))
      }
    } catch (err) {
      setTagsError(err instanceof Error ? err.message : 'Failed to load custom tags')
    } finally {
      setIsLoadingTags(false)
    }
  }, [projectId])

  // --- Issues tab fetcher ---
  const fetchIssuesSettings = useCallback(async () => {
    if (!projectId) return
    setIsLoadingIssues(true)
    setIssuesError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/issues`)
      if (!response.ok) throw new Error('Failed to load settings')
      const data = await response.json()
      if (data.settings) {
        setIssuesSettings(data.settings)
      }
    } catch (err) {
      setIssuesError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setIsLoadingIssues(false)
    }
  }, [projectId])

  // Fetch all data on mount
  useEffect(() => {
    void fetchSettings()
    void fetchSources()
    void fetchPackages()
    void fetchCustomTags()
    void fetchIssuesSettings()
  }, [fetchSettings, fetchSources, fetchPackages, fetchCustomTags, fetchIssuesSettings])

  // --- Agent event handlers ---
  const activePackage = packages.find((p) => p.id === settings.supportAgent.packageId)

  const handleSettingsSaved = () => {
    void fetchSettings()
    void fetchPackages()
  }

  const handleSourcesSaved = () => {
    void fetchSources()
  }

  const handlePackagesChange = () => {
    void fetchPackages()
    void fetchSettings()
  }

  const knowledgeRowMeta = activePackage
    ? [
        `${activePackage.sourceCount} source${activePackage.sourceCount !== 1 ? 's' : ''}`,
        activePackage.lastAnalyzedAt ? `analyzed ${formatRelativeTime(activePackage.lastAnalyzedAt)}` : null,
      ].filter(Boolean).join(' · ')
    : ''

  // --- General tab save ---
  const handleSaveGeneral = async () => {
    const trimmedName = projectName.trim()
    if (!trimmedName) {
      setGeneralError('Project name is required')
      return
    }
    setIsSavingGeneral(true)
    setGeneralError(null)
    setGeneralSaved(false)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: projectDescription.trim() || null,
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update project')
      }
      void refreshProject()
      void refreshProjects()
      setGeneralSaved(true)
      setTimeout(() => setGeneralSaved(false), 3000)
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to update project')
    } finally {
      setIsSavingGeneral(false)
    }
  }

  // --- Feedback tab save ---
  const handleSaveTags = async () => {
    setIsSavingTags(true)
    setTagsError(null)
    setTagsSaved(false)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/sessions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_tags: customTags }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save custom tags')
      }
      setTagsSaved(true)
      setTimeout(() => setTagsSaved(false), 3000)
    } catch (err) {
      setTagsError(err instanceof Error ? err.message : 'Failed to save custom tags')
    } finally {
      setIsSavingTags(false)
    }
  }

  // --- Issues tab save ---
  const handleSaveIssues = async () => {
    setIsSavingIssues(true)
    setIssuesError(null)
    setIssuesSaved(false)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/issues`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issuesSettings),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }
      setIssuesSaved(true)
      setTimeout(() => setIssuesSaved(false), 3000)
    } catch (err) {
      setIssuesError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsSavingIssues(false)
    }
  }

  // Loading state
  if (isLoadingProject || !project || !projectId || isLoading) {
    return (
      <>
        <PageHeader title="Agents & Settings" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Agents & Settings" />

      <Tabs value={activeTab} onChange={handleTabChange} className="flex-1">
        <TabsList>
          <Tab value="general">General</Tab>
          <Tab value="knowledge">Knowledge</Tab>
          <Tab value="agents">Agents</Tab>
          <Tab value="feedback">Feedback</Tab>
          <Tab value="issues">Issues</Tab>
        </TabsList>

        {/* General Tab */}
        <TabsPanel value="general">
          <div className="mx-auto max-w-2xl space-y-6">
            <Card>
              <Heading as="h3" size="subsection" className="mb-4">Project Details</Heading>
              <ProjectInfoSection
                name={projectName}
                description={projectDescription}
                onNameChange={(e: ChangeEvent<HTMLInputElement>) => setProjectName(e.target.value)}
                onDescriptionChange={(e: ChangeEvent<HTMLTextAreaElement>) => setProjectDescription(e.target.value)}
              />
              {generalError && (
                <div className="mt-4 rounded-[4px] border border-[color:var(--accent-danger)] p-3 text-sm text-[color:var(--accent-danger)]">
                  {generalError}
                </div>
              )}
              <div className="mt-6 flex items-center gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void handleSaveGeneral()}
                  disabled={isSavingGeneral}
                >
                  {isSavingGeneral ? 'Saving...' : 'Save'}
                </Button>
                {generalSaved && (
                  <span className="text-sm text-[color:var(--accent-success)]">Saved</span>
                )}
              </div>
            </Card>
          </div>
        </TabsPanel>

        {/* Knowledge Tab */}
        <TabsPanel value="knowledge">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Heading as="h3" size="subsection">Connected Knowledge Resources</Heading>
                {sources.length > 0 && <Badge variant="default">{sources.length}</Badge>}
              </div>
              <Button variant="ghost" size="md" onClick={() => setShowSourcesDialog(true)}>
                Configure
              </Button>
            </div>
            <KnowledgeSourcesList
              sources={sources}
              isLoading={isLoadingSources}
              onConfigure={() => setShowSourcesDialog(true)}
            />
          </Card>
        </TabsPanel>

        {/* Agents Tab */}
        <TabsPanel value="agents">
          <div className="grid gap-4 md:grid-cols-2">
            <AgentCard
              avatar="🎧"
              title="Support Specialist"
              description="Powers customer conversations with product knowledge"
              channels={buildSupportChannels(integrationStatuses)}
              onClick={() => setShowSupportDialog(true)}
              knowledgeRow={{
                label: activePackage ? activePackage.name : 'Not assigned',
                meta: knowledgeRowMeta,
                onClick: (e) => {
                  e.stopPropagation()
                  setShowKnowledgeDetail(true)
                },
              }}
            />
            <AgentCard
              avatar="🧭"
              title="Product Specialist"
              description="Reviews feedback, creates issues, and generates specs"
              channels={buildPmSources(integrationStatuses)}
              destinations={buildPmDestinations(integrationStatuses)}
              onClick={() => setShowPmDialog(true)}
            />
          </div>
        </TabsPanel>

        {/* Feedback Tab */}
        <TabsPanel value="feedback">
          <div className="mx-auto max-w-2xl space-y-6">
            <Card>
              <Heading as="h3" size="subsection" className="mb-4">Custom Tags</Heading>
              {isLoadingTags ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : (
                <>
                  <CustomTagsSection
                    tags={customTags}
                    onTagsChange={setCustomTags}
                    canAddMore={customTags.length < MAX_TAGS}
                    isLoading={isSavingTags}
                    error={tagsError}
                  />
                  <div className="mt-6 flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => void handleSaveTags()}
                      disabled={isSavingTags}
                    >
                      {isSavingTags ? 'Saving...' : 'Save'}
                    </Button>
                    {tagsSaved && (
                      <span className="text-sm text-[color:var(--accent-success)]">Saved</span>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsPanel>

        {/* Issues Tab */}
        <TabsPanel value="issues">
          <div className="mx-auto max-w-2xl space-y-6">
            <Card>
              <Heading as="h3" size="subsection" className="mb-4">Issue Settings</Heading>
              {isLoadingIssues ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : (
                <>
                  <TrackingToggle
                    trackingEnabled={issuesSettings.issue_tracking_enabled}
                    onTrackingEnabledChange={(enabled) => setIssuesSettings({ issue_tracking_enabled: enabled })}
                  />
                  {issuesError && (
                    <div className="mt-4 rounded-[4px] border border-[color:var(--accent-danger)] p-3 text-sm text-[color:var(--accent-danger)]">
                      {issuesError}
                    </div>
                  )}
                  <div className="mt-6 flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => void handleSaveIssues()}
                      disabled={isSavingIssues}
                    >
                      {isSavingIssues ? 'Saving...' : 'Save'}
                    </Button>
                    {issuesSaved && (
                      <span className="text-sm text-[color:var(--accent-success)]">Saved</span>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsPanel>
      </Tabs>

      {/* Dialogs */}
      <SupportAgentDialog
        open={showSupportDialog}
        onClose={() => setShowSupportDialog(false)}
        project={project}
        projectId={projectId}
        initialSettings={settings.supportAgent}
        packages={packages}
        onSaved={handleSettingsSaved}
        onOpenTestAgent={() => setShowTestAgent(true)}
        onOpenKnowledgeDetail={() => setShowKnowledgeDetail(true)}
      />

      <PmAgentDialog
        open={showPmDialog}
        onClose={() => setShowPmDialog(false)}
        projectId={projectId}
        initialSettings={settings.pmAgent}
        onSaved={handleSettingsSaved}
      />

      <KnowledgeDetailDialog
        open={showKnowledgeDetail}
        onClose={() => setShowKnowledgeDetail(false)}
        projectId={projectId}
        activePackageId={settings.supportAgent.packageId}
        onPackagesChange={handlePackagesChange}
        hasResources={sources.length > 0}
      />

      <KnowledgeSourcesDialog
        open={showSourcesDialog}
        onClose={() => setShowSourcesDialog(false)}
        projectId={projectId}
        onSaved={handleSourcesSaved}
      />

      {showTestAgent && (
        <TestAgentDialog
          project={project}
          packageId={settings.supportAgent.packageId ?? undefined}
          onClose={() => setShowTestAgent(false)}
        />
      )}
    </>
  )
}
