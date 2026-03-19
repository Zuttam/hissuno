'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useProject } from '@/components/providers/project-provider'
import { WidgetConfigDialog } from '@/components/projects/integrations/widget-config-dialog'
import { SlackConfigDialog } from '@/components/projects/integrations/slack-config-dialog'
import { GitHubConfigDialog } from '@/components/projects/integrations/github-config-dialog'
import { IntercomConfigDialog } from '@/components/projects/integrations/intercom-config-dialog'
import { GongConfigDialog } from '@/components/projects/integrations/gong-config-dialog'
import { PosthogConfigDialog } from '@/components/projects/integrations/posthog-config-dialog'
import { ZendeskConfigDialog } from '@/components/projects/integrations/zendesk-config-dialog'
import { JiraConfigDialog } from '@/components/projects/integrations/jira-config-dialog'
import { LinearConfigDialog } from '@/components/projects/integrations/linear-config-dialog'
import { NotionConfigDialog } from '@/components/projects/integrations/notion-config-dialog'
import { HubSpotConfigDialog } from '@/components/projects/integrations/hubspot-config-dialog'
import { FathomConfigDialog } from '@/components/projects/integrations/fathom-config-dialog'
import { Card } from '@/components/ui/card'
import { Badge, Button, Spinner, PageHeader } from '@/components/ui'
import {
  fetchWidgetStatus,
  fetchSlackStatus,
  fetchGithubStatus,
  fetchIntercomStatus,
  fetchZendeskStatus,
  fetchGongStatus,
  fetchPosthogStatus,
  fetchJiraStatus,
  fetchLinearStatus,
  fetchNotionStatus,
  fetchHubSpotStatus,
  fetchFathomStatus,
  fetchIntegrationsAvailability,
  type IntegrationsAvailabilityResponse,
} from '@/lib/api/integrations'

type IntegrationStatus = 'active' | 'idle' | 'not_connected'

interface Integration {
  id: string
  name: string
  description: string
  status: IntegrationStatus
  icon: React.ReactNode
  category: 'interactive' | 'sessions' | 'issues' | 'knowledge' | 'analytics' | 'customer_data'
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

function ZendeskIcon() {
  return (
    <>
      <Image src="/logos/zendesk.svg" alt="Zendesk" width={24} height={24} className="dark:hidden" />
      <Image src="/logos/zendesk-dark.svg" alt="Zendesk" width={24} height={24} className="hidden dark:block" />
    </>
  )
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

function NotionIcon() {
  return <Image src="/logos/notion.svg" alt="Notion" width={32} height={32} className="dark:invert" />
}

function GoogleDriveIcon() {
  return <Image src="/logos/google-drive.svg" alt="Google Drive" width={32} height={32} />
}

function HubSpotIcon() {
  return <Image src="/logos/hubspot.svg" alt="HubSpot" width={32} height={32} />
}

function FathomIcon() {
  return <Image src="/logos/fathom.svg" alt="Fathom" width={32} height={32} />
}

function SalesforceIcon() {
  return <Image src="/logos/salesforce.svg" alt="Salesforce" width={32} height={32} />
}

export default function IntegrationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const [showWidgetDialog, setShowWidgetDialog] = useState(false)
  const [showSlackDialog, setShowSlackDialog] = useState(false)
  const [showGithubDialog, setShowGithubDialog] = useState(false)
  const [showIntercomDialog, setShowIntercomDialog] = useState(false)
  const [showZendeskDialog, setShowZendeskDialog] = useState(false)
  const [showGongDialog, setShowGongDialog] = useState(false)
  const [showPosthogDialog, setShowPosthogDialog] = useState(false)
  const [showJiraDialog, setShowJiraDialog] = useState(false)
  const [showLinearDialog, setShowLinearDialog] = useState(false)
  const [showNotionDialog, setShowNotionDialog] = useState(false)
  const [showHubSpotDialog, setShowHubSpotDialog] = useState(false)
  const [showFathomDialog, setShowFathomDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  // integrations list is derived via useMemo below
  const [widgetStats, setWidgetStats] = useState<{ isActive: boolean; hasAnySessions: boolean } | null>(null)
  const [slackConnected, setSlackConnected] = useState(false)
  const [githubConnected, setGithubConnected] = useState(false)
  const [intercomConnected, setIntercomConnected] = useState(false)
  const [zendeskConnected, setZendeskConnected] = useState(false)
  const [gongConnected, setGongConnected] = useState(false)
  const [posthogConnected, setPosthogConnected] = useState(false)
  const [jiraConnected, setJiraConnected] = useState(false)
  const [linearConnected, setLinearConnected] = useState(false)
  const [notionConnected, setNotionConnected] = useState(false)
  const [hubspotConnected, setHubspotConnected] = useState(false)
  const [fathomConnected, setFathomConnected] = useState(false)
  const [availability, setAvailability] = useState<IntegrationsAvailabilityResponse | null>(null)

  // Fetch availability on mount
  useEffect(() => {
    fetchIntegrationsAvailability()
      .then(setAvailability)
      .catch((err) => console.error('[integrations] Failed to fetch availability:', err))
  }, [])

  // Refresh integration statuses - defined early so it can be used in useEffect
  const refreshStatuses = useCallback(async () => {
    if (!projectId) return

    try {
      const [widgetRes, slackRes, githubRes, intercomRes, zendeskRes, gongRes, posthogRes, jiraRes, linearRes, notionRes, hubspotRes, fathomRes] = await Promise.all([
        fetchWidgetStatus(projectId),
        fetchSlackStatus(projectId),
        fetchGithubStatus(projectId),
        fetchIntercomStatus(projectId),
        fetchZendeskStatus(projectId),
        fetchGongStatus(projectId),
        fetchPosthogStatus(projectId),
        fetchJiraStatus(projectId),
        fetchLinearStatus(projectId),
        fetchNotionStatus(projectId),
        fetchHubSpotStatus(projectId),
        fetchFathomStatus(projectId),
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

      if (posthogRes.ok) {
        const data = await posthogRes.json()
        setPosthogConnected(data.connected)
      }

      if (jiraRes.ok) {
        const data = await jiraRes.json()
        setJiraConnected(data.connected)
      }

      if (linearRes.ok) {
        const data = await linearRes.json()
        setLinearConnected(data.connected)
      }

      if (notionRes.ok) {
        const data = await notionRes.json()
        setNotionConnected(data.connected)
      }

      if (hubspotRes.ok) {
        const data = await hubspotRes.json()
        setHubspotConnected(data.connected)
      }

      if (fathomRes.ok) {
        const data = await fathomRes.json()
        setFathomConnected(data.connected)
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
    } else if (dialog === 'gong') {
      setShowGongDialog(true)
    } else if (dialog === 'posthog') {
      setShowPosthogDialog(true)
    } else if (dialog === 'jira') {
      setShowJiraDialog(true)
    } else if (dialog === 'linear') {
      setShowLinearDialog(true)
    } else if (dialog === 'notion') {
      setShowNotionDialog(true)
    } else if (dialog === 'hubspot') {
      setShowHubSpotDialog(true)
    } else if (dialog === 'fathom') {
      setShowFathomDialog(true)
    }

    // Handle OAuth return - clean up URL and refresh status
    const jiraJustConnected = searchParams.get('jira') === 'connected'
    const linearJustConnected = searchParams.get('linear') === 'connected'
    const intercomJustConnected = searchParams.get('intercom') === 'connected'
    const notionJustConnected = searchParams.get('notion') === 'connected'
    const hubspotJustConnected = searchParams.get('hubspot') === 'connected'
    if ((githubJustConnected || slackJustConnected || jiraJustConnected || linearJustConnected || intercomJustConnected || notionJustConnected || hubspotJustConnected) && projectId) {
      void refreshStatuses()
      if (intercomJustConnected) {
        setShowIntercomDialog(true)
      }
      if (notionJustConnected) {
        setShowNotionDialog(true)
      }
      if (hubspotJustConnected) {
        setShowHubSpotDialog(true)
      }
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

  const handleClosePosthogDialog = () => {
    setShowPosthogDialog(false)
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

  const handleCloseLinearDialog = () => {
    setShowLinearDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }

  const handleCloseNotionDialog = () => {
    setShowNotionDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }

  const handleCloseHubSpotDialog = () => {
    setShowHubSpotDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }

  const handleCloseFathomDialog = () => {
    setShowFathomDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }

  // Fetch integration statuses
  useEffect(() => {
    if (!projectId) return

    const fetchStatuses = async () => {
      try {
        const [widgetRes, slackRes, githubRes, intercomRes, zendeskRes, gongRes, posthogRes, jiraRes, linearRes, notionRes, hubspotRes, fathomRes] = await Promise.all([
          fetchWidgetStatus(projectId),
          fetchSlackStatus(projectId),
          fetchGithubStatus(projectId),
          fetchIntercomStatus(projectId),
          fetchZendeskStatus(projectId),
          fetchGongStatus(projectId),
          fetchPosthogStatus(projectId),
          fetchJiraStatus(projectId),
          fetchLinearStatus(projectId),
          fetchNotionStatus(projectId),
          fetchHubSpotStatus(projectId),
          fetchFathomStatus(projectId),
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

        if (posthogRes.ok) {
          const data = await posthogRes.json()
          setPosthogConnected(data.connected)
        }

        if (jiraRes.ok) {
          const data = await jiraRes.json()
          setJiraConnected(data.connected)
        }

        if (linearRes.ok) {
          const data = await linearRes.json()
          setLinearConnected(data.connected)
        }

        if (notionRes.ok) {
          const data = await notionRes.json()
          setNotionConnected(data.connected)
        }

        if (hubspotRes.ok) {
          const data = await hubspotRes.json()
          setHubspotConnected(data.connected)
        }

        if (fathomRes.ok) {
          const data = await fathomRes.json()
          setFathomConnected(data.connected)
        }
      } catch (err) {
        console.error('[integrations] Failed to fetch statuses:', err)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchStatuses()
  }, [projectId])

  // Check if an integration's OAuth env vars are configured
  const isOAuthAvailable = useCallback((id: string): boolean => {
    if (!availability) return true // assume available until loaded
    const info = availability.integrations[id]
    return info?.available !== false
  }, [availability])

  const getUnavailableReason = useCallback((id: string): string | undefined => {
    if (!availability) return undefined
    const info = availability.integrations[id]
    if (!info || info.available) return undefined
    return `Requires environment variables: ${info.requiredEnvVars.join(', ')}`
  }, [availability])

  // Build integrations list based on fetched statuses
  const integrations = useMemo<Integration[]>(() => [
      {
        id: 'widget',
        name: 'Widget',
        description: 'Embed the support chat widget in your application',
        status: widgetStats?.isActive ? 'active' : widgetStats?.hasAnySessions ? 'idle' : 'not_connected',
        icon: <WidgetIcon />,
        category: 'interactive',
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Connect Slack channels for customer conversations',
        status: slackConnected ? 'active' : 'not_connected',
        icon: <SlackIcon />,
        category: 'interactive',
      },
      {
        id: 'gong',
        name: 'Gong',
        description: 'Import call recordings and transcripts from Gong',
        status: gongConnected ? 'active' : 'not_connected',
        icon: <GongIcon />,
        category: 'sessions',
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
        id: 'fathom',
        name: 'Fathom',
        description: 'Import AI meeting notes and transcripts from Fathom',
        status: fathomConnected ? 'active' : 'not_connected',
        icon: <FathomIcon />,
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
        category: 'interactive',
        comingSoon: true,
      },
      {
        id: 'github',
        name: 'GitHub',
        description: 'Connect your repository for codebase knowledge analysis',
        status: githubConnected ? 'active' : 'not_connected',
        icon: <GitHubIcon />,
        category: 'knowledge',
      },
      {
        id: 'notion',
        name: 'Notion',
        description: 'Import Notion pages as knowledge sources',
        status: notionConnected ? 'active' : 'not_connected',
        icon: <NotionIcon />,
        category: 'knowledge',
      },
      {
        id: 'google-drive',
        name: 'Google Drive',
        description: 'Import documents from Google Drive as knowledge sources',
        status: 'not_connected',
        icon: <GoogleDriveIcon />,
        category: 'knowledge',
        comingSoon: true,
      },
      {
        id: 'jira',
        name: 'Jira',
        description: 'Sync issues to Jira for project management',
        status: jiraConnected ? 'active' : 'not_connected',
        icon: <JiraIcon />,
        category: 'issues',
      },
      {
        id: 'linear',
        name: 'Linear',
        description: 'Sync issues to Linear for modern project management',
        status: linearConnected ? 'active' : 'not_connected',
        icon: <LinearIcon />,
        category: 'issues',
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
        description: 'Enrich contacts with behavioral profiles from PostHog analytics',
        status: posthogConnected ? 'active' : 'not_connected',
        icon: <PostHogIcon />,
        category: 'analytics',
      },
      {
        id: 'hubspot',
        name: 'HubSpot',
        description: 'Sync companies and contacts from HubSpot CRM',
        status: hubspotConnected ? 'active' : 'not_connected',
        icon: <HubSpotIcon />,
        category: 'customer_data',
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
  ], [widgetStats, slackConnected, githubConnected, intercomConnected, zendeskConnected, gongConnected, posthogConnected, jiraConnected, linearConnected, notionConnected, hubspotConnected, fathomConnected])

  const interactiveIntegrations = integrations.filter(i => i.category === 'interactive')
  const sessionIntegrations = integrations.filter(i => i.category === 'sessions')
  const issueIntegrations = integrations.filter(i => i.category === 'issues')
  const knowledgeIntegrations = integrations.filter(i => i.category === 'knowledge')
  const analyticsIntegrations = integrations.filter(i => i.category === 'analytics')
  const customerDataIntegrations = integrations.filter(i => i.category === 'customer_data')

  // Handler for opening integration dialogs - updates URL for consistent tracking
  const handleConfigureIntegration = (integrationId: string) => {
    if (integrationId === 'widget' || integrationId === 'slack' || integrationId === 'github' || integrationId === 'intercom' || integrationId === 'zendesk' || integrationId === 'gong' || integrationId === 'posthog' || integrationId === 'jira' || integrationId === 'linear' || integrationId === 'notion' || integrationId === 'hubspot' || integrationId === 'fathom') {
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
      <PageHeader
        title="Integrations"
        actions={
          <a
            href="https://github.com/hissuno/hissuno/issues/new?labels=integration-request&title=Integration+request:+"
            target="_blank"
            rel="noopener noreferrer"
            className="mr-4 text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)] transition-colors"
          >
            Missing integration?
          </a>
        }
      />

      {/* Interactive Channels */}
      <div>
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] mb-1">
          Interactive Channels
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {interactiveIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onConfigure={() => handleConfigureIntegration(integration.id)}
            />
          ))}
        </div>
      </div>

      {/* Feedback Sources */}
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
            />
          ))}
        </div>
      </div>

      {/* Behavioral Feedback */}
      <div>
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] mb-4">
          Behavioral Feedback
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

      {/* Knowledge Sources */}
      <div>
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] mb-4">
          Knowledge Sources
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {knowledgeIntegrations.map((integration) => (
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
        oauthAvailable={isOAuthAvailable('slack')}
        oauthUnavailableReason={getUnavailableReason('slack')}
      />

      <GitHubConfigDialog
        open={showGithubDialog}
        onClose={handleCloseGithubDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
        oauthAvailable={availability?.integrations?.github?.oauthConfigured ?? false}
        oauthUnavailableReason={
          availability?.integrations?.github?.oauthConfigured === false
            ? 'Requires environment variables: GITHUB_APP_SLUG, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY'
            : undefined
        }
      />

      <IntercomConfigDialog
        open={showIntercomDialog}
        onClose={handleCloseIntercomDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
        oauthAvailable={isOAuthAvailable('intercom')}
        oauthUnavailableReason={getUnavailableReason('intercom')}
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

      <PosthogConfigDialog
        open={showPosthogDialog}
        onClose={handleClosePosthogDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
      />

      <JiraConfigDialog
        open={showJiraDialog}
        onClose={handleCloseJiraDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
        oauthAvailable={isOAuthAvailable('jira')}
        oauthUnavailableReason={getUnavailableReason('jira')}
      />

      <LinearConfigDialog
        open={showLinearDialog}
        onClose={handleCloseLinearDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
        oauthAvailable={isOAuthAvailable('linear')}
        oauthUnavailableReason={getUnavailableReason('linear')}
      />

      <NotionConfigDialog
        open={showNotionDialog}
        onClose={handleCloseNotionDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
        oauthAvailable={availability?.integrations?.notion?.oauthConfigured ?? false}
        oauthUnavailableReason={
          availability?.integrations?.notion?.oauthConfigured === false
            ? 'Requires environment variables: NOTION_CLIENT_ID, NOTION_CLIENT_SECRET'
            : undefined
        }
      />

      <HubSpotConfigDialog
        open={showHubSpotDialog}
        onClose={handleCloseHubSpotDialog}
        projectId={projectId}
        onStatusChanged={refreshStatuses}
        oauthAvailable={isOAuthAvailable('hubspot')}
        oauthUnavailableReason={getUnavailableReason('hubspot')}
      />

      <FathomConfigDialog
        open={showFathomDialog}
        onClose={handleCloseFathomDialog}
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
    <Card className="p-0">
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
    </Card>
  )
}
