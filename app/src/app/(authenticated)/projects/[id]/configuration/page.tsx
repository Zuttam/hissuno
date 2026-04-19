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
import { buildSupportChannels } from '@/components/projects/agents/agent-card'
import { SettingRow, StatusPill, ChannelsMeta } from '@/components/projects/agents/setting-row'
import { SupportAgentDialog } from '@/components/projects/agents/support-agent-dialog'
import { ProductCopilotDialog } from '@/components/projects/agents/product-copilot-dialog'
import { IssueAnalysisDialog } from '@/components/projects/workflows/issue-analysis-dialog'
import { GraphEvaluationPanel } from '@/components/projects/workflows/graph-evaluation-panel'
import { DEFAULT_GRAPH_EVAL_CONFIG, type GraphEvaluationConfig } from '@/mastra/workflows/graph-evaluation/config'
import { ProjectInfoSection } from '@/components/projects/project-info-section'
import { DangerZoneSection } from '@/components/projects/configuration/danger-zone-section'
import { FieldsEditor, type BuiltInField } from '@/components/customers/custom-fields-settings-dialog'
import { Tabs, TabsList, Tab, TabsPanel } from '@/components/ui/tabs'
import { Button, Heading, Spinner, PageHeader } from '@/components/ui'
import { formatRelativeTime } from '@/lib/utils/format-time'
import { updateProject } from '@/lib/api/projects'
import { listPackages } from '@/lib/api/knowledge'
import {
  getSupportAgentSettings,
  getIssueAnalysisSettings,
  getGraphEvaluationSettingsClient,
  getAIModelSettingsClient,
  updateAIModelSettingsClient,
} from '@/lib/api/settings'
import type { SupportPackageWithSources } from '@/lib/knowledge/types'

const ONTOLOGY_SECTIONS = ['customers', 'issues', 'feedback', 'knowledge', 'products'] as const
const ONTOLOGY_SECTION_LABELS: Record<(typeof ONTOLOGY_SECTIONS)[number], string> = {
  customers: 'Customers', issues: 'Issues', feedback: 'Feedback', knowledge: 'Knowledge', products: 'Scopes',
}

const VALID_TABS = ['general', 'access', 'ontology', 'agents-workflows', 'graph-evaluation'] as const
const LEGACY_TAB_REDIRECTS: Record<string, string> = { customers: 'ontology', feedback: 'ontology' }
type SettingsTab = (typeof VALID_TABS)[number]

const COMPANY_BUILT_IN_FIELDS: BuiltInField[] = [
  { label: 'Name', type: 'Text' },
  { label: 'Domain', type: 'Text' },
  { label: 'ARR', type: 'Number' },
  { label: 'Stage', type: 'Select' },
  { label: 'Industry', type: 'Text' },
  { label: 'Country', type: 'Text' },
  { label: 'Employee Count', type: 'Number' },
  { label: 'Plan Tier', type: 'Text' },
  { label: 'Health Score', type: 'Number' },
  { label: 'Renewal Date', type: 'Date' },
]

const CONTACT_BUILT_IN_FIELDS: BuiltInField[] = [
  { label: 'Name', type: 'Text' },
  { label: 'Email', type: 'Text' },
  { label: 'Company', type: 'Relation' },
  { label: 'Role', type: 'Text' },
  { label: 'Title', type: 'Text' },
  { label: 'Phone', type: 'Text' },
  { label: 'Champion', type: 'Yes/No' },
]

const ISSUE_BUILT_IN_FIELDS: BuiltInField[] = [
  { label: 'Name', type: 'Text' },
  { label: 'Description', type: 'Text' },
  { label: 'Type', type: 'Select', options: ['Bug', 'Feature Request', 'Change Request'] },
  { label: 'Priority', type: 'Select', options: ['Low', 'Medium', 'High'] },
  { label: 'Status', type: 'Select', options: ['Open', 'Ready', 'In Progress', 'Resolved', 'Closed'] },
]

const FEEDBACK_BUILT_IN_FIELDS: BuiltInField[] = [
  { label: 'Name', type: 'Text' },
  { label: 'Source', type: 'Select', options: ['Widget', 'Slack', 'Intercom', 'Zendesk', 'Gong', 'Fathom', 'PostHog', 'API', 'Manual'] },
  { label: 'Type', type: 'Select', options: ['Chat', 'Meeting', 'Behavioral'] },
  { label: 'Tags', type: 'Multi-select', options: ['General Feedback', 'Win', 'Loss', 'Bug', 'Feature Request', 'Change Request'] },
  { label: 'Status', type: 'Select', options: ['Active', 'Closing Soon', 'Awaiting Idle Response', 'Closed'] },
]

const KNOWLEDGE_SOURCE_BUILT_IN_FIELDS: BuiltInField[] = [
  { label: 'Name', type: 'Text' },
  { label: 'Description', type: 'Text' },
  { label: 'Type', type: 'Select', options: ['Codebase', 'Website', 'Docs Portal', 'Uploaded Document', 'Raw Text', 'Notion'] },
  { label: 'Status', type: 'Select', options: ['Pending', 'Analyzing', 'Done', 'Failed'] },
  { label: 'URL', type: 'Text' },
]

const PRODUCT_SCOPE_BUILT_IN_FIELDS: BuiltInField[] = [
  { label: 'Name', type: 'Text' },
  { label: 'Description', type: 'Text' },
  { label: 'Type', type: 'Select', options: ['Product Area', 'Initiative'] },
  { label: 'Color', type: 'Select', options: ['Blue', 'Green', 'Yellow', 'Red', 'Gray'] },
  { label: 'Goals', type: 'Multi-select' },
]

interface AgentSettings {
  supportAgent: {
    toneOfVoice: string
    brandGuidelines: string
    packageId: string | null
    sessionIdleTimeoutMinutes: number
    sessionGoodbyeDelaySeconds: number
    sessionIdleResponseTimeoutSeconds: number
  }
  issueAnalysis: {
    analysisGuidelines: string
    briefGuidelines: string
    issueAnalysisEnabled: boolean
  }
  graphEvaluation: GraphEvaluationConfig
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
  issueAnalysis: {
    analysisGuidelines: '',
    briefGuidelines: '',
    issueAnalysisEnabled: true,
  },
  graphEvaluation: DEFAULT_GRAPH_EVAL_CONFIG,
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

  // Active tab from URL (with legacy redirect support)
  const tabParam = searchParams.get('tab')
  const resolvedTab = tabParam ? (LEGACY_TAB_REDIRECTS[tabParam] ?? tabParam) : null
  const activeTab: SettingsTab = resolvedTab && VALID_TABS.includes(resolvedTab as SettingsTab) ? (resolvedTab as SettingsTab) : 'general'

  const handleTabChange = useCallback((value: string) => {
    router.replace(`/projects/${projectId}/configuration?tab=${value}`)
  }, [router, projectId])

  // --- Agent dialog visibility ---
  const [showSupportDialog, setShowSupportDialog] = useState(false)
  const [showProductCopilotDialog, setShowProductCopilotDialog] = useState(false)
  const [showTestAgent, setShowTestAgent] = useState(false)
  const [showIssueAnalysisDialog, setShowIssueAnalysisDialog] = useState(false)


  // --- Agent data ---
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [packages, setPackages] = useState<SupportPackageWithSources[]>([])

  // --- General tab state ---
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isSavingGeneral, setIsSavingGeneral] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [generalSaved, setGeneralSaved] = useState(false)

  // --- AI model settings state ---
  const [aiProvider, setAiProvider] = useState('openai')
  const [aiModelDefault, setAiModelDefault] = useState('')
  const [aiModelSmall, setAiModelSmall] = useState('')
  const [availableProviders, setAvailableProviders] = useState<string[]>([])
  const [providerConfigs, setProviderConfigs] = useState<Record<string, { label: string; icon: string; defaults: { default: string; small: string }; models: { default: string[]; small: string[] } }>>({})
  const [isEditingAiModel, setIsEditingAiModel] = useState(false)
  const [isSavingAiModel, setIsSavingAiModel] = useState(false)
  const [aiModelError, setAiModelError] = useState<string | null>(null)

  // --- Ontology sub-navigation ---
  const [ontologySection, setOntologySection] = useState<'customers' | 'issues' | 'feedback' | 'knowledge' | 'products'>('customers')


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
      const [supportAgentData, issueAnalysisData, graphEvalData] = await Promise.all([
        getSupportAgentSettings(projectId).catch(() => null),
        getIssueAnalysisSettings(projectId).catch(() => null),
        getGraphEvaluationSettingsClient(projectId).catch(() => null),
      ])

      setSettings((prev) => {
        const next = { ...prev }
        if (supportAgentData?.settings) {
          const s = supportAgentData.settings
          next.supportAgent = {
            ...prev.supportAgent,
            packageId: (s.support_agent_package_id as string) ?? null,
            toneOfVoice: (s.support_agent_tone as string) ?? 'professional',
            brandGuidelines: (s.brand_guidelines as string) ?? '',
            sessionIdleTimeoutMinutes: (s.session_idle_timeout_minutes as number) ?? 5,
            sessionGoodbyeDelaySeconds: (s.session_goodbye_delay_seconds as number) ?? 90,
            sessionIdleResponseTimeoutSeconds: (s.session_idle_response_timeout_seconds as number) ?? 60,
          }
        }
        if (issueAnalysisData?.settings) {
          const s = issueAnalysisData.settings
          next.issueAnalysis = {
            analysisGuidelines: (s.analysis_guidelines as string) ?? '',
            briefGuidelines: (s.brief_guidelines as string) ?? '',
            issueAnalysisEnabled: (s.issue_analysis_enabled as boolean) ?? true,
          }
        }
        if (graphEvalData?.config) {
          next.graphEvaluation = graphEvalData.config
        }
        return next
      })

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


  // --- AI model helpers ---
  const splitModel = (full: string) => {
    const idx = full.indexOf('/')
    return idx === -1 ? ['openai', full] : [full.slice(0, idx), full.slice(idx + 1)]
  }

  const fetchAIModelSettings = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await getAIModelSettingsClient(projectId) as {
        settings: Record<string, unknown>
        resolved?: { default: string; small: string }
        availableProviders?: string[]
        providers?: Record<string, { label: string; icon: string; defaults: { default: string; small: string }; models: { default: string[]; small: string[] } }>
      }
      if (data.resolved) {
        const [provider, model] = splitModel(data.resolved.default)
        const [, modelSmall] = splitModel(data.resolved.small)
        setAiProvider(provider)
        setAiModelDefault(model)
        setAiModelSmall(modelSmall)
      }
      if (data.availableProviders) setAvailableProviders(data.availableProviders)
      if (data.providers) setProviderConfigs(data.providers)
    } catch (err) {
      console.error('[ai-model] Failed to fetch settings:', err)
    }
  }, [projectId])

  // Fetch all data on mount
  useEffect(() => {
    void fetchSettings()
    void fetchPackages()
    void fetchAIModelSettings()
  }, [fetchSettings, fetchPackages, fetchAIModelSettings])

  const handleSaveAiModel = async () => {
    setIsSavingAiModel(true)
    setAiModelError(null)
    try {
      const defaultFull = aiModelDefault.trim() ? `${aiProvider}/${aiModelDefault.trim()}` : null
      const smallFull = aiModelSmall.trim() ? `${aiProvider}/${aiModelSmall.trim()}` : null
      await updateAIModelSettingsClient(projectId!, {
        ai_model: defaultFull,
        ai_model_small: smallFull,
      })
      setIsEditingAiModel(false)
    } catch (err) {
      setAiModelError(err instanceof Error ? err.message : 'Failed to save AI model settings')
    } finally {
      setIsSavingAiModel(false)
    }
  }

  const handleProviderChange = (provider: string) => {
    setAiProvider(provider)
    const config = providerConfigs[provider]
    if (config) {
      setAiModelDefault(config.defaults.default)
      setAiModelSmall(config.defaults.small)
    }
  }

  const currentProviderConfig = providerConfigs[aiProvider]

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
          <Tab value="ontology">Ontology</Tab>
          <Tab value="agents-workflows">Agents & Automations</Tab>
          <Tab value="graph-evaluation">Graph Evaluation</Tab>
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

        {/* Ontology Tab */}
        <TabsPanel value="ontology">
          {/* Sub-navigation pills */}
          <div className="mb-6 flex gap-1">
            {ONTOLOGY_SECTIONS.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => setOntologySection(section)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  ontologySection === section
                    ? 'bg-[color:var(--background-secondary)] font-medium text-[color:var(--foreground)]'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)]'
                }`}
              >
                {ONTOLOGY_SECTION_LABELS[section]}
              </button>
            ))}
          </div>

          <div className="max-w-2xl flex flex-col gap-6">
            {/* Customers section */}
            {ontologySection === 'customers' && (
              <>
                <FieldsEditor projectId={projectId} entityType="company" builtInFields={COMPANY_BUILT_IN_FIELDS} title="Company Fields" />

                <div className="border-t border-[color:var(--border-subtle)]" />

                <FieldsEditor projectId={projectId} entityType="contact" builtInFields={CONTACT_BUILT_IN_FIELDS} title="Contact Fields" />
              </>
            )}

            {/* Issues section */}
            {ontologySection === 'issues' && (
              <FieldsEditor projectId={projectId} entityType="issue" builtInFields={ISSUE_BUILT_IN_FIELDS} title="Issue Fields" />
            )}

            {/* Feedback section */}
            {ontologySection === 'feedback' && (
              <FieldsEditor projectId={projectId} entityType="session" builtInFields={FEEDBACK_BUILT_IN_FIELDS} title="Feedback Fields" />
            )}

            {ontologySection === 'knowledge' && (
              <FieldsEditor projectId={projectId} entityType="knowledge_source" builtInFields={KNOWLEDGE_SOURCE_BUILT_IN_FIELDS} title="Knowledge Source Fields" />
            )}

            {ontologySection === 'products' && (
              <FieldsEditor projectId={projectId} entityType="product_scope" builtInFields={PRODUCT_SCOPE_BUILT_IN_FIELDS} title="Scope Fields" />
            )}
          </div>
        </TabsPanel>

        {/* Agents & Automations Tab */}
        <TabsPanel value="agents-workflows">
          {/* AI Model Configuration */}
          <div className="mb-8 max-w-2xl">
            <h3 className="mb-4 font-mono text-sm uppercase tracking-wide text-[color:var(--text-secondary)]">
              AI Model
            </h3>
            {!isEditingAiModel ? (
              <button
                type="button"
                onClick={() => setIsEditingAiModel(true)}
                className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left transition-colors hover:bg-[color:var(--surface-hover)]"
              >
                <span className="flex items-center gap-3 text-sm">
                  {currentProviderConfig?.icon && (
                    <img src={currentProviderConfig.icon} alt="" className="h-5 w-5 rounded-sm" />
                  )}
                  <span className="font-medium">{currentProviderConfig?.label ?? aiProvider}</span>
                  <span className="flex items-center gap-1.5 text-[color:var(--text-secondary)]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
                    {aiModelDefault || '(default)'}
                  </span>
                  <span className="flex items-center gap-1.5 text-[color:var(--text-tertiary)]">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
                    {aiModelSmall || '(default)'}
                  </span>
                  {!availableProviders.includes(aiProvider) && (
                    <span className="text-xs text-[color:var(--accent-warning)]">(no API key)</span>
                  )}
                </span>
                <svg className="h-4 w-4 text-[color:var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                </svg>
              </button>
            ) : (
              <div className="rounded-lg border border-[color:var(--border-subtle)] p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1.5 text-xs text-[color:var(--text-secondary)]">
                    {currentProviderConfig?.icon && (
                      <img src={currentProviderConfig.icon} alt="" className="h-3 w-3 rounded-sm" />
                    )}
                    Provider
                  </label>
                  <select
                    value={aiProvider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full rounded-md border border-[color:var(--border-subtle)] bg-transparent px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none"
                  >
                    {Object.entries(providerConfigs).map(([key, config]) => (
                      <option key={key} value={key} disabled={!availableProviders.includes(key)}>
                        {config.label}{!availableProviders.includes(key) ? ' (no API key)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="flex items-center gap-1.5 text-xs text-[color:var(--text-secondary)]">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
                      Default model
                    </label>
                    <select
                      value={aiModelDefault}
                      onChange={(e) => setAiModelDefault(e.target.value)}
                      className="w-full rounded-md border border-[color:var(--border-subtle)] bg-transparent px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none"
                    >
                      {(currentProviderConfig?.models.default ?? []).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-[color:var(--text-tertiary)]">Agents, issue creation, and deep analysis</p>
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="flex items-center gap-1.5 text-xs text-[color:var(--text-secondary)]">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
                      Small model
                    </label>
                    <select
                      value={aiModelSmall}
                      onChange={(e) => setAiModelSmall(e.target.value)}
                      className="w-full rounded-md border border-[color:var(--border-subtle)] bg-transparent px-3 py-2 text-sm focus:border-[color:var(--accent-primary)] focus:outline-none"
                    >
                      {(currentProviderConfig?.models.small ?? []).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-[color:var(--text-tertiary)]">Tagging, classification, summaries, and topic extraction</p>
                  </div>
                </div>
                {aiModelError && (
                  <p className="text-xs text-[color:var(--accent-danger)]">{aiModelError}</p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => void handleSaveAiModel()}
                    disabled={isSavingAiModel}
                  >
                    {isSavingAiModel ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => { setIsEditingAiModel(false); void fetchAIModelSettings() }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="max-w-2xl flex flex-col gap-8">
            <div>
              <h3 className="mb-3 font-mono text-sm uppercase tracking-wide text-[color:var(--text-secondary)]">
                Agents
              </h3>
              <div className="rounded-md border border-[color:var(--border-subtle)] overflow-hidden">
                <SettingRow
                  icon="🎧"
                  title="Customer Agent"
                  description={
                    activePackage
                      ? `Knowledge: ${activePackage.name}${knowledgeRowMeta ? ` · ${knowledgeRowMeta}` : ''}`
                      : 'Customer-facing support with knowledge base'
                  }
                  rightMeta={<ChannelsMeta channels={buildSupportChannels(integrationStatuses)} />}
                  onClick={() => setShowSupportDialog(true)}
                />
                <SettingRow
                  icon="🧭"
                  title="Product Co-pilot"
                  description="Team agent with full data access"
                  rightMeta={<ChannelsMeta channels={buildSupportChannels(integrationStatuses)} />}
                  onClick={() => setShowProductCopilotDialog(true)}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-mono text-sm uppercase tracking-wide text-[color:var(--text-secondary)]">
                Automations
              </h3>
              <div className="rounded-md border border-[color:var(--border-subtle)] overflow-hidden">
                <SettingRow
                  icon="🎯"
                  title="Issue Analysis"
                  description="Scores reach, impact, confidence, effort and generates a brief"
                  rightMeta={<StatusPill enabled={settings.issueAnalysis.issueAnalysisEnabled} />}
                  onClick={() => setShowIssueAnalysisDialog(true)}
                  disabled={!settings.issueAnalysis.issueAnalysisEnabled}
                />
              </div>
            </div>
          </div>
        </TabsPanel>

        {/* Graph Evaluation Tab */}
        <TabsPanel value="graph-evaluation">
          <div className="max-w-2xl flex flex-col gap-6">
            <div>
              <Heading as="h3" size="subsection">Graph Evaluation</Heading>
              <p className="text-sm text-[color:var(--text-secondary)] mt-1">
                Discovers relationships between entities and optionally creates new ones from feedback.
              </p>
            </div>
            <GraphEvaluationPanel
              projectId={projectId}
              config={settings.graphEvaluation}
              onSaved={handleSettingsSaved}
            />
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

      <IssueAnalysisDialog
        open={showIssueAnalysisDialog}
        onClose={() => setShowIssueAnalysisDialog(false)}
        projectId={projectId}
        analysisGuidelines={settings.issueAnalysis.analysisGuidelines}
        briefGuidelines={settings.issueAnalysis.briefGuidelines}
        issueAnalysisEnabled={settings.issueAnalysis.issueAnalysisEnabled}
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
