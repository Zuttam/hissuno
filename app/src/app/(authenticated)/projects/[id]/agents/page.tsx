'use client'

import { useState, useEffect, useCallback } from 'react'
import { useProject } from '@/components/providers/project-provider'
import { useIntegrationStatuses } from '@/hooks/use-integration-statuses'
import { TestAgentDialog } from '@/components/projects/test-agent-dialog'
import { KnowledgeSourcesList } from '@/components/projects/knowledge/knowledge-sources-list'
import { KnowledgeSourcesDialog } from '@/components/projects/edit-dialogs/knowledge-sources-dialog'
import { AgentCard, buildSupportChannels, buildPmSources, buildPmDestinations } from '@/components/projects/agents/agent-card'
import { SupportAgentDialog } from '@/components/projects/agents/support-agent-dialog'
import { PmAgentDialog } from '@/components/projects/agents/pm-agent-dialog'
import { KnowledgeDetailDialog } from '@/components/projects/agents/knowledge-detail-dialog'
import { FloatingCard } from '@/components/ui/floating-card'
import { Button, Heading, Spinner, PageHeader, Badge } from '@/components/ui'
import { formatRelativeTime } from '@/lib/utils/format-time'
import type { KnowledgeSourceRecord, NamedPackageWithSources } from '@/lib/knowledge/types'

interface AgentSettings {
  supportAgent: {
    toneOfVoice: string
    brandGuidelines: string
    packageId: string | null
  }
  pmAgent: {
    classificationGuidelines: string
    specGuidelines: string
    autoSpecThreshold: number
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
    autoSpecThreshold: 3,
  },
}

export default function AgentsPage() {
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const { statuses: integrationStatuses } = useIntegrationStatuses(projectId)

  // Dialog visibility
  const [showSupportDialog, setShowSupportDialog] = useState(false)
  const [showPmDialog, setShowPmDialog] = useState(false)
  const [showTestAgent, setShowTestAgent] = useState(false)
  const [showSourcesDialog, setShowSourcesDialog] = useState(false)
  const [showKnowledgeDetail, setShowKnowledgeDetail] = useState(false)

  // Data
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [sources, setSources] = useState<KnowledgeSourceRecord[]>([])
  const [isLoadingSources, setIsLoadingSources] = useState(true)
  const [packages, setPackages] = useState<NamedPackageWithSources[]>([])

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    if (!projectId) return

    try {
      const [settingsRes, supportAgentRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/settings`),
        fetch(`/api/projects/${projectId}/settings/support-agent`),
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
            pmAgent: {
              classificationGuidelines: data.settings.classification_guidelines ?? '',
              specGuidelines: data.settings.spec_guidelines ?? '',
              autoSpecThreshold: data.settings.auto_spec_threshold ?? 3,
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
    } catch (err) {
      console.error('[agents] Failed to fetch settings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // Fetch knowledge sources
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

  // Fetch packages
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

  useEffect(() => {
    void fetchSettings()
    void fetchSources()
    void fetchPackages()
  }, [fetchSettings, fetchSources, fetchPackages])

  // Resolve active package name for card display
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

  // Build knowledge row meta text
  const knowledgeRowMeta = activePackage
    ? [
        `${activePackage.sourceCount} source${activePackage.sourceCount !== 1 ? 's' : ''}`,
        activePackage.lastAnalyzedAt ? `analyzed ${formatRelativeTime(activePackage.lastAnalyzedAt)}` : null,
      ].filter(Boolean).join(' · ')
    : ''

  // Loading state
  if (isLoadingProject || !project || !projectId || isLoading) {
    return (
      <>
        <PageHeader title="Agents" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Agents" />

      {/* Connected Resources */}
      <FloatingCard floating="gentle">
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
      </FloatingCard>

      {/* Agent Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Support Specialist */}
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

        {/* The Captain (PM Agent) */}
        <AgentCard
          avatar="🧭"
          title="The Captain"
          description="Reviews sessions, creates issues, and generates specs"
          channels={buildPmSources(integrationStatuses)}
          destinations={buildPmDestinations(integrationStatuses)}
          onClick={() => setShowPmDialog(true)}
        />
      </div>

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
