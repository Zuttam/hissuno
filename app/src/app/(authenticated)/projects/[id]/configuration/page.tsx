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
import { AgentCard, buildSupportChannels } from '@/components/projects/agents/agent-card'
import { SupportAgentDialog } from '@/components/projects/agents/support-agent-dialog'
import { ProductCopilotDialog } from '@/components/projects/agents/product-copilot-dialog'
import { WorkflowCard } from '@/components/projects/workflows/workflow-card'
import { FeedbackReviewDialog } from '@/components/projects/workflows/feedback-review-dialog'
import { IssueAnalysisDialog } from '@/components/projects/workflows/issue-analysis-dialog'
import { KnowledgeAnalysisDialog } from '@/components/projects/workflows/knowledge-analysis-dialog'
import { ProjectInfoSection } from '@/components/projects/configuration/project-info-section'
import { DangerZoneSection } from '@/components/projects/configuration/danger-zone-section'
import { CustomTagsSection, type LocalCustomTag } from '@/components/projects/configuration/custom-tags-section'
import { TrackingToggle, type IssuesSettings } from '@/components/projects/configuration/issues-settings'
import { FieldsEditor } from '@/components/customers/custom-fields-settings-dialog'
import { Tabs, TabsList, Tab, TabsPanel } from '@/components/ui/tabs'
import { Button, Heading, Spinner, PageHeader } from '@/components/ui'
import { formatRelativeTime } from '@/lib/utils/format-time'
import { updateProject } from '@/lib/api/projects'
import { listPackages } from '@/lib/api/knowledge'
import {
  getSupportAgentSettings,
  getFeedbackReviewSettings,
  getIssueAnalysisSettings,
  getKnowledgeAnalysisSettings,
  getFeedbackIssuesSettings,
  updateFeedbackIssuesSettings,
} from '@/lib/api/settings'
import type { KnowledgePackageWithSources } from '@/lib/knowledge/types'

const VALID_TABS = ['general', 'access', 'customers', 'agents-workflows', 'feedback'] as const
type SettingsTab = (typeof VALID_TABS)[number]

const MAX_TAGS = 10

interface AgentSettings {
  supportAgent: {
    toneOfVoice: string
    brandGuidelines: string
    packageId: string | null
    sessionIdleTimeoutMinutes: number
    sessionGoodbyeDelaySeconds: number
    sessionIdleResponseTimeoutSeconds: number
  }
  feedbackReview: {
    classificationGuidelines: string
    analysisGuidelines: string
  }
  issueAnalysis: {
    analysisGuidelines: string
    briefGuidelines: string
  }
  knowledgeAnalysis: {
    relationshipGuidelines: string
  }
}

const DEFAULT_SETTINGS: AgentSettings = {
  supportAgent: {
    toneOfVoice: 'professional',
    brandGuidelines: '',
    packageId: null,
    sessionIdleTimeoutMinutes: 5,
    sessionGoodbyeDelaySeconds: 90,
    sessionIdleResponseTimeoutSeconds: 60,
  },
  feedbackReview: {
    classificationGuidelines: '',
    analysisGuidelines: '',
  },
  issueAnalysis: {
    analysisGuidelines: '',
    briefGuidelines: '',
  },
  knowledgeAnalysis: {
    relationshipGuidelines: '',
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

  // Active tab from URL
  const tabParam = searchParams.get('tab')
  const resolvedTab = tabParam
  const activeTab: SettingsTab = resolvedTab && VALID_TABS.includes(resolvedTab as SettingsTab) ? (resolvedTab as SettingsTab) : 'general'

  const handleTabChange = useCallback((value: string) => {
    router.replace(`/projects/${projectId}/configuration?tab=${value}`)
  }, [router, projectId])

  // --- Agent dialog visibility ---
  const [showSupportDialog, setShowSupportDialog] = useState(false)
  const [showProductCopilotDialog, setShowProductCopilotDialog] = useState(false)
  const [showTestAgent, setShowTestAgent] = useState(false)
  const [showFeedbackReviewDialog, setShowFeedbackReviewDialog] = useState(false)
  const [showIssueAnalysisDialog, setShowIssueAnalysisDialog] = useState(false)
  const [showKnowledgeAnalysisDialog, setShowKnowledgeAnalysisDialog] = useState(false)

  // --- Agent data ---
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [packages, setPackages] = useState<KnowledgePackageWithSources[]>([])

  // --- General tab state ---
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isSavingGeneral, setIsSavingGeneral] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [generalSaved, setGeneralSaved] = useState(false)

  // --- Feedback tab state ---
  const [customTags, setCustomTags] = useState<LocalCustomTag[]>([])
  const [issuesSettings, setIssuesSettings] = useState<IssuesSettings>({ issue_tracking_enabled: true })
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true)

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
      const [supportAgentData, feedbackReviewData, issueAnalysisData, knowledgeAnalysisData] = await Promise.all([
        getSupportAgentSettings(projectId).catch(() => null),
        getFeedbackReviewSettings(projectId).catch(() => null),
        getIssueAnalysisSettings(projectId).catch(() => null),
        getKnowledgeAnalysisSettings(projectId).catch(() => null),
      ])

      if (supportAgentData?.settings) {
        const s = supportAgentData.settings
        setSettings((prev) => ({
          ...prev,
          supportAgent: {
            ...prev.supportAgent,
            packageId: (s.support_agent_package_id as string) ?? null,
            toneOfVoice: (s.support_agent_tone as string) ?? 'professional',
            brandGuidelines: (s.brand_guidelines as string) ?? '',
            sessionIdleTimeoutMinutes: (s.session_idle_timeout_minutes as number) ?? 5,
            sessionGoodbyeDelaySeconds: (s.session_goodbye_delay_seconds as number) ?? 90,
            sessionIdleResponseTimeoutSeconds: (s.session_idle_response_timeout_seconds as number) ?? 60,
          },
        }))
      }

      if (feedbackReviewData?.settings) {
        const s = feedbackReviewData.settings
        setSettings((prev) => ({
          ...prev,
          feedbackReview: {
            classificationGuidelines: (s.classification_guidelines as string) ?? '',
            analysisGuidelines: (s.analysis_guidelines as string) ?? '',
          },
        }))
      }

      if (issueAnalysisData?.settings) {
        const s = issueAnalysisData.settings
        setSettings((prev) => ({
          ...prev,
          issueAnalysis: {
            analysisGuidelines: (s.analysis_guidelines as string) ?? '',
            briefGuidelines: (s.brief_guidelines as string) ?? '',
          },
        }))
      }

      if (knowledgeAnalysisData?.settings) {
        const s = knowledgeAnalysisData.settings
        setSettings((prev) => ({
          ...prev,
          knowledgeAnalysis: {
            relationshipGuidelines: (s.knowledge_relationship_guidelines as string) ?? '',
          },
        }))
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
      const data = await listPackages(projectId)
      setPackages(data.packages ?? [])
    } catch (err) {
      console.error('[agents] Failed to fetch packages:', err)
    }
  }, [projectId])

  // --- Unified feedback settings fetcher ---
  const fetchFeedbackSettings = useCallback(async () => {
    if (!projectId) return
    setIsLoadingFeedback(true)
    try {
      const data = await getFeedbackIssuesSettings(projectId)
      setCustomTags((data.customTags ?? []).map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        description: tag.description,
        color: tag.color as LocalCustomTag['color'],
        position: tag.position,
      })))
      if (data.issueSettings) {
        setIssuesSettings(data.issueSettings as unknown as IssuesSettings)
      }
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to load feedback settings')
    } finally {
      setIsLoadingFeedback(false)
    }
  }, [projectId])

  // Fetch all data on mount
  useEffect(() => {
    void fetchSettings()
    void fetchPackages()
    void fetchFeedbackSettings()
  }, [fetchSettings, fetchPackages, fetchFeedbackSettings])

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
      await updateProject(projectId!, {
        name: trimmedName,
        description: projectDescription.trim() || null,
      })
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
      await updateFeedbackIssuesSettings(projectId!, { custom_tags: tags })
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
      await updateFeedbackIssuesSettings(projectId!, { issue_tracking_enabled: enabled })
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
          <Tab value="agents-workflows">Agents & Workflows</Tab>
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
            <DangerZoneSection projectId={projectId} projectName={project.name} isOwner={isOwner} />
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
              <div className="flex flex-col gap-1">
                <Heading as="h3" size="subsection">Company Fields</Heading>
                <p className="text-sm text-[color:var(--text-secondary)]">
                  Define custom fields to capture additional information about your companies.
                </p>
              </div>
              <FieldsEditor projectId={projectId} entityType="company" />
            </div>

            {/* Divider */}
            <div className="border-t border-[color:var(--border-subtle)]" />

            {/* Contact Fields */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Heading as="h3" size="subsection">Contact Fields</Heading>
                <p className="text-sm text-[color:var(--text-secondary)]">
                  Define custom fields to capture additional information about your contacts.
                </p>
              </div>
              <FieldsEditor projectId={projectId} entityType="contact" />
            </div>
          </div>
        </TabsPanel>

        {/* Agents & Workflows Tab */}
        <TabsPanel value="agents-workflows">
          <h3 className="mb-4 font-mono text-sm uppercase tracking-wide text-[color:var(--text-secondary)]">
            Agents
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <AgentCard
              avatar="🎧"
              title="Customer Agent"
              description="Customer-facing support with knowledge base"
              channels={buildSupportChannels(integrationStatuses)}
              onClick={() => setShowSupportDialog(true)}
              knowledgeRow={{
                label: activePackage ? activePackage.name : 'Not assigned',
                meta: knowledgeRowMeta,
                onClick: (e) => {
                  e.stopPropagation()
                  setShowSupportDialog(true)
                },
              }}
            />
            <AgentCard
              avatar="🧭"
              title="Product Co-pilot"
              description="Team agent with full data access via MCP"
              channels={buildSupportChannels(integrationStatuses)}
              onClick={() => setShowProductCopilotDialog(true)}
            />
          </div>

          <div className="mt-8">
            <h3 className="mb-4 font-mono text-sm uppercase tracking-wide text-[color:var(--text-secondary)]">
              Agentic Automations
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <WorkflowCard
                icon="📋"
                title="Feedback Review"
                description="Classifies feedback and creates issues"
                steps={['Classify Feedback', 'Summarize', 'Create or Upvote Issue']}
                onClick={() => setShowFeedbackReviewDialog(true)}
              />
              <WorkflowCard
                icon="📊"
                title="Issue Analysis"
                description="Scores reach, impact, confidence, effort and generates a brief"
                steps={['Analyze Impact & Effort', 'Compute Scores', 'Generate Brief']}
                onClick={() => setShowIssueAnalysisDialog(true)}
              />
              <WorkflowCard
                icon="📚"
                title="Knowledge Analysis"
                description="Analyzes sources and finds relationships to existing entities"
                steps={['Fetch Content', 'Analyze', 'Embed', 'Find Relationships']}
                onClick={() => setShowKnowledgeAnalysisDialog(true)}
              />
            </div>
          </div>
        </TabsPanel>

        {/* Feedback & Issues Tab */}
        <TabsPanel value="feedback">
          <div className="max-w-2xl flex flex-col gap-6">
            {isLoadingFeedback ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : (
              <>
                {/* Custom Tags Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Heading as="h3" size="subsection">Custom Tags</Heading>
                    {tagsSaved && (
                      <span className="text-sm text-[color:var(--accent-success)]">Saved</span>
                    )}
                  </div>
                  <CustomTagsSection
                    tags={customTags}
                    onTagsChange={setCustomTags}
                    onCommit={handleSaveTags}
                    canAddMore={customTags.length < MAX_TAGS}
                    error={null}
                  />
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
                  <TrackingToggle
                    trackingEnabled={issuesSettings.issue_tracking_enabled}
                    onTrackingEnabledChange={(enabled) => void handleTrackingEnabledChange(enabled)}
                  />
                </div>
              </>
            )}

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
        projectId={projectId}
        integrationStatuses={integrationStatuses}
        initialSettings={settings.supportAgent}
        onSaved={handleSettingsSaved}
        onOpenTestAgent={() => setShowTestAgent(true)}
        onPackagesChange={handlePackagesChange}
      />

      <ProductCopilotDialog
        open={showProductCopilotDialog}
        onClose={() => setShowProductCopilotDialog(false)}
        projectId={projectId}
        integrationStatuses={integrationStatuses}
      />

      <FeedbackReviewDialog
        open={showFeedbackReviewDialog}
        onClose={() => setShowFeedbackReviewDialog(false)}
        projectId={projectId}
        classificationGuidelines={settings.feedbackReview.classificationGuidelines}
        analysisGuidelines={settings.feedbackReview.analysisGuidelines}
        onSaved={handleSettingsSaved}
      />
      <IssueAnalysisDialog
        open={showIssueAnalysisDialog}
        onClose={() => setShowIssueAnalysisDialog(false)}
        projectId={projectId}
        analysisGuidelines={settings.issueAnalysis.analysisGuidelines}
        briefGuidelines={settings.issueAnalysis.briefGuidelines}
        onSaved={handleSettingsSaved}
      />
      <KnowledgeAnalysisDialog
        open={showKnowledgeAnalysisDialog}
        onClose={() => setShowKnowledgeAnalysisDialog(false)}
        projectId={projectId}
        relationshipGuidelines={settings.knowledgeAnalysis.relationshipGuidelines}
        onSaved={handleSettingsSaved}
      />
      {showTestAgent && (
        <TestAgentDialog
          project={project}
          packageId={settings.supportAgent.packageId ?? undefined}
          onClose={() => {
            setShowTestAgent(false)
            setShowSupportDialog(true)
          }}
        />
      )}
    </>
  )
}
