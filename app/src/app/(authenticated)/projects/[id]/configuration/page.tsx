'use client'

import { useState, useEffect, useCallback, useMemo, type ChangeEvent } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useProject } from '@/components/providers/project-provider'
import { useUser } from '@/components/providers/auth-provider'
import { useIntegrationStatuses } from '@/hooks/use-integration-statuses'
import { useProjectMembers } from '@/hooks/use-project-members'
import { useProjectApiKeys } from '@/hooks/use-project-api-keys'
import { MembersSection } from '@/components/access/members-section'
import { ApiKeysSection } from '@/components/access/api-keys-section'
import { TestAgentDialog } from '@/components/projects/test-agent-dialog'
import { KnowledgeSourcesPanel } from '@/components/projects/edit-dialogs/knowledge-sources-dialog'
import { AgentCard, buildSupportChannels, buildPmSources, buildPmDestinations } from '@/components/projects/agents/agent-card'
import { SupportAgentDialog } from '@/components/projects/agents/support-agent-dialog'
import { PmAgentDialog } from '@/components/projects/agents/pm-agent-dialog'
import { KnowledgeDetailDialog } from '@/components/projects/agents/knowledge-detail-dialog'
import { ProjectInfoSection } from '@/components/projects/edit-dialogs/project-details-dialog'
import { CustomTagsSection, type LocalCustomTag } from '@/components/projects/edit-dialogs/sessions-settings-dialog'
import { TrackingToggle, type IssuesSettings } from '@/components/projects/edit-dialogs/issues-settings-dialog'
import { FieldsEditor } from '@/components/customers/custom-fields-settings-dialog'
import { Tabs, TabsList, Tab, TabsPanel } from '@/components/ui/tabs'
import { Button, Heading, Spinner, PageHeader } from '@/components/ui'
import { formatRelativeTime } from '@/lib/utils/format-time'
import type { NamedPackageWithSources } from '@/lib/knowledge/types'

const VALID_TABS = ['general', 'access', 'customers', 'knowledge', 'agents', 'feedback'] as const
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
  const { user } = useUser()
  const { statuses: integrationStatuses } = useIntegrationStatuses(projectId)

  // --- Access tab ---
  const { members, isLoading: isLoadingMembers, refresh: refreshMembers } = useProjectMembers(projectId ?? undefined)
  const { apiKeys, isLoading: isLoadingApiKeys, refresh: refreshApiKeys } = useProjectApiKeys(projectId ?? undefined)
  const isOwner = useMemo(() => {
    if (!user) return false
    return members.some((m) => m.user_id === user.id && m.role === 'owner' && m.status === 'active')
  }, [members, user])

  // Active tab from URL — map legacy "issues" param to "feedback"
  const tabParam = searchParams.get('tab')
  const resolvedTab = tabParam === 'issues' ? 'feedback' : tabParam
  const activeTab: SettingsTab = resolvedTab && VALID_TABS.includes(resolvedTab as SettingsTab) ? (resolvedTab as SettingsTab) : 'general'

  const handleTabChange = useCallback((value: string) => {
    router.replace(`/projects/${projectId}/configuration?tab=${value}`)
  }, [router, projectId])

  // --- Agent dialog visibility ---
  const [showSupportDialog, setShowSupportDialog] = useState(false)
  const [showPmDialog, setShowPmDialog] = useState(false)
  const [showTestAgent, setShowTestAgent] = useState(false)
  const [showKnowledgeDetail, setShowKnowledgeDetail] = useState(false)

  // --- Agent data ---
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
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

  // --- Issues state (rendered under Feedback tab) ---
  const [issuesSettings, setIssuesSettings] = useState<IssuesSettings>({ issue_tracking_enabled: true })
  const [isLoadingIssues, setIsLoadingIssues] = useState(true)

  // --- Feedback auto-save state ---
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [tagsSaved, setTagsSaved] = useState(false)
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
      setFeedbackError(err instanceof Error ? err.message : 'Failed to load custom tags')
    } finally {
      setIsLoadingTags(false)
    }
  }, [projectId])

  // --- Issues fetcher ---
  const fetchIssuesSettings = useCallback(async () => {
    if (!projectId) return
    setIsLoadingIssues(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/issues`)
      if (!response.ok) throw new Error('Failed to load settings')
      const data = await response.json()
      if (data.settings) {
        setIssuesSettings(data.settings)
      }
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setIsLoadingIssues(false)
    }
  }, [projectId])

  // Fetch all data on mount
  useEffect(() => {
    void fetchSettings()
    void fetchPackages()
    void fetchCustomTags()
    void fetchIssuesSettings()
  }, [fetchSettings, fetchPackages, fetchCustomTags, fetchIssuesSettings])

  // --- Agent event handlers ---
  const activePackage = packages.find((p) => p.id === settings.supportAgent.packageId)

  const handleSettingsSaved = () => {
    void fetchSettings()
    void fetchPackages()
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

  // --- Auto-save custom tags ---
  const handleSaveTags = useCallback(async (tags: LocalCustomTag[]) => {
    setFeedbackError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/sessions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_tags: tags }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save custom tags')
      }
      setTagsSaved(true)
      setTimeout(() => setTagsSaved(false), 3000)
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to save custom tags')
    }
  }, [projectId])

  // --- Auto-save issue tracking toggle ---
  const handleTrackingEnabledChange = useCallback(async (enabled: boolean) => {
    const previous = issuesSettings.issue_tracking_enabled
    setIssuesSettings({ issue_tracking_enabled: enabled })
    setFeedbackError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/issues`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_tracking_enabled: enabled }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save issue settings')
      }
      setIssuesSaved(true)
      setTimeout(() => setIssuesSaved(false), 3000)
    } catch (err) {
      setIssuesSettings({ issue_tracking_enabled: previous })
      setFeedbackError(err instanceof Error ? err.message : 'Failed to save issue settings')
    }
  }, [projectId, issuesSettings.issue_tracking_enabled])

  // Loading state
  if (isLoadingProject || !project || !projectId || isLoading) {
    return (
      <>
        <PageHeader title="Configuration" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Configuration" />

      <Tabs value={activeTab} onChange={handleTabChange} className="flex-1">
        <TabsList>
          <Tab value="general">General</Tab>
          <Tab value="access">Access</Tab>
          <Tab value="customers">Customers</Tab>
          <Tab value="knowledge">Knowledge</Tab>
          <Tab value="agents">Agents</Tab>
          <Tab value="feedback">Feedback & Issues</Tab>
        </TabsList>

        {/* General Tab */}
        <TabsPanel value="general">
          <div className="max-w-2xl flex flex-col gap-6">
            <Heading as="h3" size="subsection">Project Details</Heading>
            <ProjectInfoSection
              name={projectName}
              description={projectDescription}
              onNameChange={(e: ChangeEvent<HTMLInputElement>) => setProjectName(e.target.value)}
              onDescriptionChange={(e: ChangeEvent<HTMLTextAreaElement>) => setProjectDescription(e.target.value)}
            />
            {generalError && (
              <div className="rounded-[4px] border border-[color:var(--accent-danger)] p-3 text-sm text-[color:var(--accent-danger)]">
                {generalError}
              </div>
            )}
            <div className="flex items-center gap-3">
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
          </div>
        </TabsPanel>

        {/* Access Tab */}
        <TabsPanel value="access">
          <div className="max-w-3xl flex flex-col gap-6">
            <MembersSection
              projectId={projectId}
              members={members}
              isLoading={isLoadingMembers}
              onRefresh={refreshMembers}
              isOwner={isOwner}
            />
            <ApiKeysSection
              projectId={projectId}
              apiKeys={apiKeys}
              isLoading={isLoadingApiKeys}
              onRefresh={refreshApiKeys}
              isOwner={isOwner}
            />
          </div>
        </TabsPanel>

        {/* Customers Tab */}
        <TabsPanel value="customers">
          <div className="max-w-2xl flex flex-col gap-6">
            {/* Company Fields */}
            <div className="flex flex-col gap-4">
              <Heading as="h3" size="subsection">Company Fields</Heading>
              <p className="text-sm text-[color:var(--text-secondary)]">
                Define custom fields to capture additional information about your companies.
              </p>
              <FieldsEditor projectId={projectId} entityType="company" />
            </div>

            {/* Divider */}
            <div className="border-t border-[color:var(--border-subtle)]" />

            {/* Contact Fields */}
            <div className="flex flex-col gap-4">
              <Heading as="h3" size="subsection">Contact Fields</Heading>
              <p className="text-sm text-[color:var(--text-secondary)]">
                Define custom fields to capture additional information about your contacts.
              </p>
              <FieldsEditor projectId={projectId} entityType="contact" />
            </div>
          </div>
        </TabsPanel>

        {/* Knowledge Tab */}
        <TabsPanel value="knowledge">
          <div className="max-w-2xl flex flex-col gap-6">
            <Heading as="h3" size="subsection">Knowledge Sources</Heading>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Connect codebases, websites, documentation, and custom text to give your agents context about your product.
            </p>
            <KnowledgeSourcesPanel projectId={projectId} onSourcesChange={handleSettingsSaved} />
          </div>
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

        {/* Feedback & Issues Tab */}
        <TabsPanel value="feedback">
          <div className="max-w-2xl flex flex-col gap-6">
            {/* Custom Tags Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Heading as="h3" size="subsection">Custom Tags</Heading>
                {tagsSaved && (
                  <span className="text-sm text-[color:var(--accent-success)]">Saved</span>
                )}
              </div>
              {isLoadingTags ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : (
                <CustomTagsSection
                  tags={customTags}
                  onTagsChange={setCustomTags}
                  onCommit={handleSaveTags}
                  canAddMore={customTags.length < MAX_TAGS}
                  error={null}
                />
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-[color:var(--border-subtle)]" />

            {/* Issue Tracking Section */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Heading as="h3" size="subsection">Issue Tracking</Heading>
                {issuesSaved && (
                  <span className="text-sm text-[color:var(--accent-success)]">Saved</span>
                )}
              </div>
              {isLoadingIssues ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : (
                <TrackingToggle
                  trackingEnabled={issuesSettings.issue_tracking_enabled}
                  onTrackingEnabledChange={(enabled) => void handleTrackingEnabledChange(enabled)}
                />
              )}
            </div>

            {/* Inline error */}
            {feedbackError && (
              <div className="rounded-[4px] border border-[color:var(--accent-danger)] p-3 text-sm text-[color:var(--accent-danger)]">
                {feedbackError}
              </div>
            )}
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
        hasResources
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
