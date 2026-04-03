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
import { IssueAnalysisDialog } from '@/components/projects/workflows/issue-analysis-dialog'
import { GraphEvaluationDialog } from '@/components/projects/workflows/graph-evaluation-dialog'
import { ProjectInfoSection } from '@/components/projects/configuration/project-info-section'
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
} from '@/lib/api/settings'
import type { KnowledgePackageWithSources } from '@/lib/knowledge/types'

const ONTOLOGY_SECTIONS = ['customers', 'issues', 'feedback', 'knowledge', 'products'] as const
const ONTOLOGY_SECTION_LABELS: Record<(typeof ONTOLOGY_SECTIONS)[number], string> = {
  customers: 'Customers', issues: 'Issues', feedback: 'Feedback', knowledge: 'Knowledge', products: 'Scopes',
}

const VALID_TABS = ['general', 'access', 'ontology', 'agents-workflows'] as const
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
  graphEvaluation: {
    creationPolicyEnabled: boolean
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
  issueAnalysis: {
    analysisGuidelines: '',
    briefGuidelines: '',
    issueAnalysisEnabled: true,
  },
  graphEvaluation: {
    creationPolicyEnabled: true,
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
  const [showGraphEvalDialog, setShowGraphEvalDialog] = useState(false)


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
        if (graphEvalData?.settings) {
          const s = graphEvalData.settings
          next.graphEvaluation = {
            creationPolicyEnabled: (s.creation_policy_enabled as boolean) ?? true,
          }
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


  // Fetch all data on mount
  useEffect(() => {
    void fetchSettings()
    void fetchPackages()
  }, [fetchSettings, fetchPackages])

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
                icon="🕸️"
                title="Graph Evaluation"
                description="Discovers relationships and creates entities from feedback"
                steps={['Load Entity Content', 'Extract Topics', 'Discover Relationships', 'Create New Resources']}
                enabled={settings.graphEvaluation.creationPolicyEnabled}
                onClick={() => setShowGraphEvalDialog(true)}
              />
              <WorkflowCard
                icon="📊"
                title="Issue Analysis"
                description="Scores reach, impact, confidence, effort and generates a brief"
                steps={['Analyze Impact & Effort', 'Compute Scores', 'Generate Brief']}
                enabled={settings.issueAnalysis.issueAnalysisEnabled}
                onClick={() => setShowIssueAnalysisDialog(true)}
              />
            </div>
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
      <GraphEvaluationDialog
        open={showGraphEvalDialog}
        onClose={() => setShowGraphEvalDialog(false)}
        projectId={projectId}
        creationPolicyEnabled={settings.graphEvaluation.creationPolicyEnabled}
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
