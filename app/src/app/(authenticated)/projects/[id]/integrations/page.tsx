'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useProject } from '@/components/providers/project-provider'
import { WidgetConfigDialog } from '@/components/projects/edit-dialogs/widget-config-dialog'
import { SlackConfigDialog } from '@/components/projects/edit-dialogs/slack-config-dialog'
import { GitHubConfigDialog } from '@/components/projects/edit-dialogs/github-config-dialog'
import { FloatingCard } from '@/components/ui/floating-card'
import { Badge, Button, Spinner, PageHeader } from '@/components/ui'

type IntegrationStatus = 'active' | 'idle' | 'not_connected'

interface Integration {
  id: string
  name: string
  description: string
  status: IntegrationStatus
  icon: React.ReactNode
  category: 'sessions' | 'issues' | 'development'
  comingSoon?: boolean
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const statusConfig: Record<IntegrationStatus, { label: string; variant: 'success' | 'warning' | 'default' }> = {
    active: { label: 'Active', variant: 'success' },
    idle: { label: 'Idle', variant: 'warning' },
    not_connected: { label: 'Not Connected', variant: 'default' },
  }

  const config = statusConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

// Icons
function WidgetIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  )
}

function SlackIcon() {
  return <Image src="/logos/slack.svg" alt="Slack" width={32} height={32} />
}

function GitHubIcon() {
  return <Image src="/logos/github.svg" alt="GitHub" width={32} height={32} />
}

function JiraIcon() {
  return <Image src="/logos/jira.svg" alt="Jira" width={32} height={32} />
}

function LinearIcon() {
  return <Image src="/logos/linear.svg" alt="Linear" width={32} height={32} />
}

function GongIcon() {
  return <Image src="/logos/gong.svg" alt="Gong" width={32} height={32} />
}

function IntercomIcon() {
  return <Image src="/logos/intercom.svg" alt="Intercom" width={32} height={32} />
}

export default function IntegrationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const [showWidgetDialog, setShowWidgetDialog] = useState(false)
  const [showSlackDialog, setShowSlackDialog] = useState(false)
  const [showGithubDialog, setShowGithubDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [widgetStats, setWidgetStats] = useState<{ isActive: boolean } | null>(null)
  const [slackConnected, setSlackConnected] = useState(false)
  const [githubConnected, setGithubConnected] = useState(false)

  // Refresh integration statuses - defined early so it can be used in useEffect
  const refreshStatuses = useCallback(async () => {
    if (!projectId) return

    try {
      const [widgetRes, slackRes, githubRes] = await Promise.all([
        fetch(`/api/sessions?projectId=${projectId}&stats=true`),
        fetch(`/api/integrations/slack?projectId=${projectId}`),
        fetch(`/api/integrations/github?projectId=${projectId}`),
      ])

      if (widgetRes.ok) {
        const data = await widgetRes.json()
        setWidgetStats(data.stats)
      }

      if (slackRes.ok) {
        const data = await slackRes.json()
        setSlackConnected(data.connected)
      }

      if (githubRes.ok) {
        const data = await githubRes.json()
        setGithubConnected(data.connected)
      }
    } catch (err) {
      console.error('[integrations] Failed to refresh statuses:', err)
    }
  }, [projectId])

  // Auto-open dialog based on URL param and handle OAuth returns
  useEffect(() => {
    const dialog = searchParams.get('dialog')
    const githubJustConnected = searchParams.get('github') === 'connected'
    const slackJustConnected = searchParams.get('slack') === 'connected'

    if (dialog === 'widget') {
      setShowWidgetDialog(true)
    } else if (dialog === 'slack') {
      setShowSlackDialog(true)
    } else if (dialog === 'github') {
      setShowGithubDialog(true)
    }

    // Handle OAuth return - clean up URL and refresh status
    if ((githubJustConnected || slackJustConnected) && projectId) {
      void refreshStatuses()
      router.replace(`/projects/${projectId}/integrations`)
    }
  }, [searchParams, projectId, router, refreshStatuses])

  // Clear URL param when dialog closes
  const handleCloseWidgetDialog = () => {
    setShowWidgetDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }

  const handleCloseSlackDialog = () => {
    setShowSlackDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }

  const handleCloseGithubDialog = () => {
    setShowGithubDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }

  // Fetch integration statuses
  useEffect(() => {
    if (!projectId) return

    const fetchStatuses = async () => {
      try {
        const [widgetRes, slackRes, githubRes] = await Promise.all([
          fetch(`/api/sessions?projectId=${projectId}&stats=true`),
          fetch(`/api/integrations/slack?projectId=${projectId}`),
          fetch(`/api/integrations/github?projectId=${projectId}`),
        ])

        if (widgetRes.ok) {
          const data = await widgetRes.json()
          setWidgetStats(data.stats)
        }

        if (slackRes.ok) {
          const data = await slackRes.json()
          setSlackConnected(data.connected)
        }

        if (githubRes.ok) {
          const data = await githubRes.json()
          setGithubConnected(data.connected)
        }
      } catch (err) {
        console.error('[integrations] Failed to fetch statuses:', err)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchStatuses()
  }, [projectId])

  // Build integrations list based on fetched statuses
  useEffect(() => {
    setIntegrations([
      {
        id: 'widget',
        name: 'Widget',
        description: 'Embed the support chat widget in your application',
        status: widgetStats?.isActive ? 'active' : 'idle',
        icon: <WidgetIcon />,
        category: 'sessions',
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Connect Slack channels to capture customer conversations',
        status: slackConnected ? 'active' : 'not_connected',
        icon: <SlackIcon />,
        category: 'sessions',
      },
      {
        id: 'gong',
        name: 'Gong',
        description: 'Import call recordings and transcripts from Gong',
        status: 'not_connected',
        icon: <GongIcon />,
        category: 'sessions',
        comingSoon: true,
      },
      {
        id: 'intercom',
        name: 'Intercom',
        description: 'Sync conversations from Intercom',
        status: 'not_connected',
        icon: <IntercomIcon />,
        category: 'sessions',
        comingSoon: true,
      },
      {
        id: 'github',
        name: 'GitHub',
        description: 'Connect your repository for codebase knowledge analysis',
        status: githubConnected ? 'active' : 'not_connected',
        icon: <GitHubIcon />,
        category: 'development',
      },
      {
        id: 'jira',
        name: 'Jira',
        description: 'Sync issues to Jira for project management',
        status: 'not_connected',
        icon: <JiraIcon />,
        category: 'issues',
        comingSoon: true,
      },
      {
        id: 'linear',
        name: 'Linear',
        description: 'Sync issues to Linear for modern project management',
        status: 'not_connected',
        icon: <LinearIcon />,
        category: 'issues',
        comingSoon: true,
      },
    ])
  }, [widgetStats, slackConnected, githubConnected])

  const sessionIntegrations = integrations.filter(i => i.category === 'sessions')
  const issueIntegrations = integrations.filter(i => i.category === 'issues')
  const developmentIntegrations = integrations.filter(i => i.category === 'development')

  // Handler for opening integration dialogs - updates URL for consistent tracking
  const handleConfigureIntegration = (integrationId: string) => {
    if (integrationId === 'widget' || integrationId === 'slack' || integrationId === 'github') {
      router.push(`/projects/${projectId}/integrations?dialog=${integrationId}`)
    }
  }

  // Show loading state
  if (isLoadingProject || !project || !projectId || isLoading) {
    return (
      <>
        <PageHeader title="Integrations" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Integrations" />

    
      {/* Session Sources */}
      <div>
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] mb-4">
          Session Sources
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {sessionIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onConfigure={() => handleConfigureIntegration(integration.id)}
            />
          ))}
        </div>
      </div>

      {/* Development */}
      <div>
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] mb-4">
          Development
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {developmentIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onConfigure={() => handleConfigureIntegration(integration.id)}
            />
          ))}
        </div>
      </div>

      {/* Issue Tracking */}
      <div>
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] mb-4">
          Issue Tracking
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {issueIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onConfigure={() => handleConfigureIntegration(integration.id)}
            />
          ))}
        </div>
      </div>

      <WidgetConfigDialog
        open={showWidgetDialog}
        onClose={handleCloseWidgetDialog}
        projectId={projectId}
        secretKey={project.secret_key}
        onSaved={refreshStatuses}
      />

      <SlackConfigDialog
        open={showSlackDialog}
        onClose={handleCloseSlackDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
        nextUrl={`/projects/${projectId}/integrations`}
      />

      <GitHubConfigDialog
        open={showGithubDialog}
        onClose={handleCloseGithubDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
      />
    </>
  )
}

interface IntegrationCardProps {
  integration: Integration
  onConfigure?: () => void
}

function IntegrationCard({ integration, onConfigure }: IntegrationCardProps) {
  return (
    <FloatingCard floating="gentle" className="p-0">
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 text-[color:var(--foreground)]">
            {integration.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-mono text-sm font-semibold uppercase text-[color:var(--foreground)]">
                {integration.name}
              </h4>
              {integration.comingSoon ? (
                <Badge variant="default">Coming Soon</Badge>
              ) : (
                <StatusBadge status={integration.status} />
              )}
            </div>
            <p className="text-sm text-[color:var(--text-secondary)]">
              {integration.description}
            </p>
          </div>
          {!integration.comingSoon && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onConfigure}
            >
              Configure
            </Button>
          )}
        </div>
      </div>
    </FloatingCard>
  )
}
