'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useProject } from '@/components/providers/project-provider'
import { useUser } from '@/components/providers/auth-provider'
import { useSupportWidget } from '@/components/providers/support-widget-provider'
import { useFeatureFlag } from '@/hooks/use-feature-flag'
import { trackFeatureAccessRequested } from '@/lib/event_tracking/events'
import { WidgetConfigDialog } from '@/components/projects/edit-dialogs/widget-config-dialog'
import { SlackConfigDialog } from '@/components/projects/edit-dialogs/slack-config-dialog'
import { GitHubConfigDialog } from '@/components/projects/edit-dialogs/github-config-dialog'
import { IntercomConfigDialog } from '@/components/projects/edit-dialogs/intercom-config-dialog'
import { GongConfigDialog } from '@/components/projects/edit-dialogs/gong-config-dialog'
import { ZendeskConfigDialog } from '@/components/projects/edit-dialogs/zendesk-config-dialog'
import { JiraConfigDialog } from '@/components/projects/edit-dialogs/jira-config-dialog'
import { FloatingCard } from '@/components/ui/floating-card'
import { Badge, Button, Spinner, PageHeader } from '@/components/ui'

type IntegrationStatus = 'active' | 'idle' | 'not_connected'

interface Integration {
  id: string
  name: string
  description: string
  status: IntegrationStatus
  icon: React.ReactNode
  category: 'sessions' | 'issues' | 'development' | 'analytics' | 'customer_data'
  comingSoon?: boolean
  requestAccess?: boolean
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

function ZendeskIcon() {
  return <Image src="/logos/zendesk.svg" alt="Zendesk" width={32} height={32} />
}

function GmailIcon() {
  return <Image src="/logos/gmail.svg" alt="Gmail" width={32} height={32} />
}

function AmplitudeIcon() {
  return <Image src="/logos/amplitude.svg" alt="Amplitude" width={32} height={32} />
}

function PostHogIcon() {
  return <Image src="/logos/posthog.svg" alt="PostHog" width={32} height={32} />
}

function HubSpotIcon() {
  return <Image src="/logos/hubspot.svg" alt="HubSpot" width={32} height={32} />
}

function SalesforceIcon() {
  return <Image src="/logos/salesforce.svg" alt="Salesforce" width={32} height={32} />
}

export default function IntegrationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const { user } = useUser()
  const { openWithPrompt } = useSupportWidget()
  
  const [gongAccessRequested, setGongAccessRequested] = useState(false)
  const [isRequestingGongAccess, setIsRequestingGongAccess] = useState(false)
  const [jiraAccessRequested, setJiraAccessRequested] = useState(false)
  const [isRequestingJiraAccess, setIsRequestingJiraAccess] = useState(false)
  const [showWidgetDialog, setShowWidgetDialog] = useState(false)
  const [showSlackDialog, setShowSlackDialog] = useState(false)
  const [showGithubDialog, setShowGithubDialog] = useState(false)
  const [showIntercomDialog, setShowIntercomDialog] = useState(false)
  const [showZendeskDialog, setShowZendeskDialog] = useState(false)
  const [showGongDialog, setShowGongDialog] = useState(false)
  const [showJiraDialog, setShowJiraDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [widgetStats, setWidgetStats] = useState<{ isActive: boolean; hasAnySessions: boolean } | null>(null)
  const [slackConnected, setSlackConnected] = useState(false)
  const [githubConnected, setGithubConnected] = useState(false)
  const [intercomConnected, setIntercomConnected] = useState(false)
  const [zendeskConnected, setZendeskConnected] = useState(false)
  const [gongConnected, setGongConnected] = useState(false)
  const [jiraConnected, setJiraConnected] = useState(false)
  const {enabled: gongEnabled, isLoading: isGongLoading}  = useFeatureFlag('gong-integration')
  const {enabled: jiraEnabled, isLoading: isJiraLoading}  = useFeatureFlag('jira-integration')

  const handleRequestAccess = async (feature: string, setRequested: (v: boolean) => void, setRequesting: (v: boolean) => void) => {
    if (!user?.email) return
    setRequesting(true)
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          source: feature,
          type: 'feature_access',
        }),
      })
      setRequested(true)
      trackFeatureAccessRequested({ feature })
    } catch (err) {
      console.error(`[integrations] Failed to request ${feature} access:`, err)
    } finally {
      setRequesting(false)
    }
  }

  const handleRequestGongAccess = () => void handleRequestAccess('gong_integration', setGongAccessRequested, setIsRequestingGongAccess)
  const handleRequestJiraAccess = () => void handleRequestAccess('jira_integration', setJiraAccessRequested, setIsRequestingJiraAccess)

  // Refresh integration statuses - defined early so it can be used in useEffect
  const refreshStatuses = useCallback(async () => {
    if (!projectId) return

    try {
      const [widgetRes, slackRes, githubRes, intercomRes, zendeskRes, gongRes, jiraRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/sessions?stats=true`),
        fetch(`/api/integrations/slack?projectId=${projectId}`),
        fetch(`/api/integrations/github?projectId=${projectId}`),
        fetch(`/api/integrations/intercom?projectId=${projectId}`),
        fetch(`/api/integrations/zendesk?projectId=${projectId}`),
        fetch(`/api/integrations/gong?projectId=${projectId}`),
        fetch(`/api/integrations/jira?projectId=${projectId}`),
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

      if (intercomRes.ok) {
        const data = await intercomRes.json()
        setIntercomConnected(data.connected)
      }

      if (zendeskRes.ok) {
        const data = await zendeskRes.json()
        setZendeskConnected(data.connected)
      }

      if (gongRes.ok) {
        const data = await gongRes.json()
        setGongConnected(data.connected)
      }

      if (jiraRes.ok) {
        const data = await jiraRes.json()
        setJiraConnected(data.connected)
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
    } else if (dialog === 'intercom') {
      setShowIntercomDialog(true)
    } else if (dialog === 'zendesk') {
      setShowZendeskDialog(true)
    } else if (dialog === 'gong' && gongEnabled) {
      setShowGongDialog(true)
    } else if (dialog === 'jira' && jiraEnabled) {
      setShowJiraDialog(true)
    }

    // Handle OAuth return - clean up URL and refresh status
    const jiraJustConnected = searchParams.get('jira') === 'connected'
    const intercomJustConnected = searchParams.get('intercom') === 'connected'
    if ((githubJustConnected || slackJustConnected || jiraJustConnected || intercomJustConnected) && projectId) {
      void refreshStatuses()
      if (intercomJustConnected) {
        setShowIntercomDialog(true)
      }
      router.replace(`/projects/${projectId}/integrations`)
    }
  }, [searchParams, projectId, router, refreshStatuses, gongEnabled, jiraEnabled])

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

  const handleCloseIntercomDialog = () => {
    setShowIntercomDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }

  const handleCloseZendeskDialog = () => {
    setShowZendeskDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }

  const handleCloseGongDialog = () => {
    setShowGongDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }

  const handleCloseJiraDialog = () => {
    setShowJiraDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }

  // Fetch integration statuses
  useEffect(() => {
    if (!projectId) return

    const fetchStatuses = async () => {
      try {
        const [widgetRes, slackRes, githubRes, intercomRes, zendeskRes, gongRes, jiraRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/sessions?stats=true`),
          fetch(`/api/integrations/slack?projectId=${projectId}`),
          fetch(`/api/integrations/github?projectId=${projectId}`),
          fetch(`/api/integrations/intercom?projectId=${projectId}`),
          fetch(`/api/integrations/zendesk?projectId=${projectId}`),
          fetch(`/api/integrations/gong?projectId=${projectId}`),
          fetch(`/api/integrations/jira?projectId=${projectId}`),
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

        if (intercomRes.ok) {
          const data = await intercomRes.json()
          setIntercomConnected(data.connected)
        }

        if (zendeskRes.ok) {
          const data = await zendeskRes.json()
          setZendeskConnected(data.connected)
        }

        if (gongRes.ok) {
          const data = await gongRes.json()
          setGongConnected(data.connected)
        }

        if (jiraRes.ok) {
          const data = await jiraRes.json()
          setJiraConnected(data.connected)
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
        status: widgetStats?.isActive ? 'active' : widgetStats?.hasAnySessions ? 'idle' : 'not_connected',
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
        status: gongConnected ? 'active' : 'not_connected',
        icon: <GongIcon />,
        category: 'sessions',
        requestAccess: !gongEnabled,
      },
      {
        id: 'intercom',
        name: 'Intercom',
        description: 'Sync conversations from Intercom',
        status: intercomConnected ? 'active' : 'not_connected',
        icon: <IntercomIcon />,
        category: 'sessions',
      },
      {
        id: 'zendesk',
        name: 'Zendesk',
        description: 'Sync solved/closed tickets from Zendesk',
        status: zendeskConnected ? 'active' : 'not_connected',
        icon: <ZendeskIcon />,
        category: 'sessions',
      },
      {
        id: 'gmail',
        name: 'Gmail',
        description: 'Import customer emails and support threads from Gmail',
        status: 'not_connected',
        icon: <GmailIcon />,
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
        status: jiraConnected ? 'active' : 'not_connected',
        icon: <JiraIcon />,
        category: 'issues',
        requestAccess: !jiraEnabled,
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
      {
        id: 'amplitude',
        name: 'Amplitude',
        description: 'Connect product analytics data to enhance customer insights',
        status: 'not_connected',
        icon: <AmplitudeIcon />,
        category: 'analytics',
        comingSoon: true,
      },
      {
        id: 'posthog',
        name: 'PostHog',
        description: 'Sync user behavior data for deeper feedback context',
        status: 'not_connected',
        icon: <PostHogIcon />,
        category: 'analytics',
        comingSoon: true,
      },
      {
        id: 'hubspot',
        name: 'HubSpot',
        description: 'Sync companies and contacts from HubSpot CRM',
        status: 'not_connected',
        icon: <HubSpotIcon />,
        category: 'customer_data',
        comingSoon: true,
      },
      {
        id: 'salesforce',
        name: 'Salesforce',
        description: 'Sync companies and contacts from Salesforce',
        status: 'not_connected',
        icon: <SalesforceIcon />,
        category: 'customer_data',
        comingSoon: true,
      },
    ])
  }, [widgetStats, slackConnected, githubConnected, intercomConnected, zendeskConnected, gongConnected, jiraConnected, gongEnabled, jiraEnabled])

  const sessionIntegrations = integrations.filter(i => i.category === 'sessions')
  const issueIntegrations = integrations.filter(i => i.category === 'issues')
  const developmentIntegrations = integrations.filter(i => i.category === 'development')
  const analyticsIntegrations = integrations.filter(i => i.category === 'analytics')
  const customerDataIntegrations = integrations.filter(i => i.category === 'customer_data')

  // Handler for opening integration dialogs - updates URL for consistent tracking
  const handleConfigureIntegration = (integrationId: string) => {
    if (integrationId === 'gong' && !gongEnabled) return
    if (integrationId === 'jira' && !jiraEnabled) return
    if (integrationId === 'widget' || integrationId === 'slack' || integrationId === 'github' || integrationId === 'intercom' || integrationId === 'zendesk' || integrationId === 'gong' || integrationId === 'jira') {
      router.push(`/projects/${projectId}/integrations?dialog=${integrationId}`)
    }
  }

  // Handler for missing integration link - opens support widget with pre-filled prompt
  const handleMissingIntegration = () => {
    openWithPrompt("Hey I'm missing an integration in hissuno... ")
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
      <PageHeader
        title="Integrations"
        actions={
          <button
            onClick={handleMissingIntegration}
            className="mr-4 text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)] transition-colors"
          >
            Missing integration?
          </button>
        }
      />

      {/* Session Sources */}
      <div>
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] mb-4">
          Feedback Sources
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {sessionIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onConfigure={() => handleConfigureIntegration(integration.id)}
              onRequestAccess={integration.id === 'gong' ? handleRequestGongAccess : undefined}
              accessRequested={integration.id === 'gong' ? gongAccessRequested : undefined}
              isRequestingAccess={integration.id === 'gong' ? isRequestingGongAccess : undefined}
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
              onRequestAccess={integration.id === 'jira' ? handleRequestJiraAccess : undefined}
              accessRequested={integration.id === 'jira' ? jiraAccessRequested : undefined}
              isRequestingAccess={integration.id === 'jira' ? isRequestingJiraAccess : undefined}
            />
          ))}
        </div>
      </div>

      {/* Behavioral Analysis */}
      <div>
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] mb-4">
          Behavioral Analysis
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {analyticsIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onConfigure={() => handleConfigureIntegration(integration.id)}
            />
          ))}
        </div>
      </div>

      {/* Customer Data */}
      <div>
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] mb-4">
          Customer Data
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {customerDataIntegrations.map((integration) => (
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

      <IntercomConfigDialog
        open={showIntercomDialog}
        onClose={handleCloseIntercomDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
      />

      <ZendeskConfigDialog
        open={showZendeskDialog}
        onClose={handleCloseZendeskDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
      />

      <GongConfigDialog
        open={showGongDialog}
        onClose={handleCloseGongDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
      />

      <JiraConfigDialog
        open={showJiraDialog}
        onClose={handleCloseJiraDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
      />
    </>
  )
}

interface IntegrationCardProps {
  integration: Integration
  onConfigure?: () => void
  onRequestAccess?: () => void
  accessRequested?: boolean
  isRequestingAccess?: boolean
}

function IntegrationCard({ integration, onConfigure, onRequestAccess, accessRequested, isRequestingAccess }: IntegrationCardProps) {
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
              ) : integration.requestAccess ? (
                <Badge variant="info">Early Access</Badge>
              ) : (
                <StatusBadge status={integration.status} />
              )}
            </div>
            <p className="text-sm text-[color:var(--text-secondary)]">
              {integration.description}
            </p>
          </div>
          {integration.comingSoon ? null : integration.requestAccess ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={accessRequested ? undefined : onRequestAccess}
              disabled={isRequestingAccess || accessRequested}
            >
              {isRequestingAccess ? 'Requesting...' : accessRequested ? 'Requested' : 'Request Access'}
            </Button>
          ) : (
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
