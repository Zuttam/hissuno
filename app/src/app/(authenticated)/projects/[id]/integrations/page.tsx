'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
import { Spinner, PageHeader } from '@/components/ui'
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
import { ConnectedList, type ConnectionInfo } from '@/components/projects/integrations/connected-list'
import { ConnectDropdown } from '@/components/projects/integrations/connect-dropdown'
import { Marketplace } from '@/components/projects/integrations/marketplace'

export default function IntegrationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading: isLoadingProject } = useProject()

  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [activeDialog, setActiveDialog] = useState<{ type: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [availability, setAvailability] = useState<IntegrationsAvailabilityResponse | null>(null)

  // Fetch availability on mount
  useEffect(() => {
    fetchIntegrationsAvailability()
      .then(setAvailability)
      .catch((err) => console.error('[integrations] Failed to fetch availability:', err))
  }, [])

  // Fetch all integration statuses and build connections list
  const refreshConnections = useCallback(async () => {
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

      const conns: ConnectionInfo[] = []

      if (widgetRes.ok) {
        const data = await widgetRes.json()
        if (data.stats?.isActive || data.stats?.hasAnySessions) {
          conns.push({
            id: 'widget',
            type: 'widget',
            name: 'Widget',
            detail: '',
            status: data.stats.isActive ? 'active' : 'idle',
            lastSyncAt: null,
          })
        }
      }

      if (slackRes.ok) {
        const data = await slackRes.json()
        if (data.connected) {
          conns.push({
            id: 'slack',
            type: 'slack',
            name: 'Slack',
            detail: data.workspaceName || '',
            status: 'active',
            lastSyncAt: null,
          })
        }
      }

      if (githubRes.ok) {
        const data = await githubRes.json()
        if (data.connected) {
          conns.push({
            id: 'github',
            type: 'github',
            name: 'GitHub',
            detail: data.accountLogin || '',
            status: 'active',
            lastSyncAt: null,
          })
        }
      }

      if (intercomRes.ok) {
        const data = await intercomRes.json()
        if (data.connected) {
          conns.push({
            id: 'intercom',
            type: 'intercom',
            name: 'Intercom',
            detail: data.workspaceName || '',
            status: 'active',
            lastSyncAt: data.lastSyncAt || null,
          })
        }
      }

      if (zendeskRes.ok) {
        const data = await zendeskRes.json()
        if (data.connected) {
          conns.push({
            id: 'zendesk',
            type: 'zendesk',
            name: 'Zendesk',
            detail: data.subdomain || '',
            status: 'active',
            lastSyncAt: data.lastSyncAt || null,
          })
        }
      }

      if (gongRes.ok) {
        const data = await gongRes.json()
        if (data.connected) {
          conns.push({
            id: 'gong',
            type: 'gong',
            name: 'Gong',
            detail: '',
            status: 'active',
            lastSyncAt: data.lastSyncAt || null,
          })
        }
      }

      if (posthogRes.ok) {
        const data = await posthogRes.json()
        if (data.connected) {
          conns.push({
            id: 'posthog',
            type: 'posthog',
            name: 'PostHog',
            detail: data.host || '',
            status: 'active',
            lastSyncAt: data.lastSyncAt || null,
          })
        }
      }

      if (jiraRes.ok) {
        const data = await jiraRes.json()
        if (data.connected) {
          conns.push({
            id: 'jira',
            type: 'jira',
            name: 'Jira',
            detail: data.siteUrl || '',
            status: 'active',
            lastSyncAt: null,
          })
        }
      }

      if (linearRes.ok) {
        const data = await linearRes.json()
        if (data.connected) {
          conns.push({
            id: 'linear',
            type: 'linear',
            name: 'Linear',
            detail: data.organizationName || '',
            status: 'active',
            lastSyncAt: null,
          })
        }
      }

      if (notionRes.ok) {
        const data = await notionRes.json()
        if (data.connected) {
          conns.push({
            id: 'notion',
            type: 'notion',
            name: 'Notion',
            detail: data.workspaceName || '',
            status: 'active',
            lastSyncAt: null,
          })
        }
      }

      if (hubspotRes.ok) {
        const data = await hubspotRes.json()
        if (data.connected) {
          conns.push({
            id: 'hubspot',
            type: 'hubspot',
            name: 'HubSpot',
            detail: data.hubName || '',
            status: 'active',
            lastSyncAt: data.lastSyncAt || null,
          })
        }
      }

      if (fathomRes.ok) {
        const data = await fathomRes.json()
        if (data.connected) {
          conns.push({
            id: 'fathom',
            type: 'fathom',
            name: 'Fathom',
            detail: '',
            status: 'active',
            lastSyncAt: data.lastSyncAt || null,
          })
        }
      }

      setConnections(conns)
    } catch (err) {
      console.error('[integrations] Failed to refresh statuses:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      void refreshConnections()
    }
  }, [projectId, refreshConnections])

  // Auto-open dialog based on URL param and handle OAuth returns
  useEffect(() => {
    const dialog = searchParams.get('dialog')
    if (dialog) {
      setActiveDialog({ type: dialog })
    }

    // Handle OAuth return - clean up URL and refresh status
    const oauthTypes = ['github', 'slack', 'jira', 'linear', 'intercom', 'notion', 'hubspot']
    const justConnected = oauthTypes.find((t) => searchParams.get(t) === 'connected')
    if (justConnected && projectId) {
      void refreshConnections()
      setActiveDialog({ type: justConnected })
      router.replace(`/projects/${projectId}/integrations`)
    }
  }, [searchParams, projectId, router, refreshConnections])

  const connectedTypes = useMemo(() => new Set(connections.map((c) => c.type)), [connections])

  // Check if an integration's OAuth env vars are configured
  const isOAuthAvailable = useCallback((id: string): boolean => {
    if (!availability) return true
    const info = availability.integrations[id]
    return info?.available !== false
  }, [availability])

  const getUnavailableReason = useCallback((id: string): string | undefined => {
    if (!availability) return undefined
    const info = availability.integrations[id]
    if (!info || info.available) return undefined
    return `Requires environment variables: ${info.requiredEnvVars.join(', ')}`
  }, [availability])

  const handleCloseDialog = useCallback(() => {
    setActiveDialog(null)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }, [searchParams, router, projectId])

  const openDialog = useCallback((type: string) => {
    setActiveDialog({ type })
    router.push(`/projects/${projectId}/integrations?dialog=${type}`)
  }, [router, projectId])

  // Loading state
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
        actions={<ConnectDropdown onSelect={openDialog} />}
      />

      <ConnectedList connections={connections} onSelect={openDialog} />

      <hr className="border-[color:var(--border-subtle)]" />

      <Marketplace connectedTypes={connectedTypes} onSelect={openDialog} />

      {/* Dialogs - only render the active one */}
      {activeDialog?.type === 'widget' && (
        <WidgetConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          secretKey={project.secret_key}
          onSaved={refreshConnections}
        />
      )}

      {activeDialog?.type === 'slack' && (
        <SlackConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          onStatusChanged={refreshConnections}
          nextUrl={`/projects/${projectId}/integrations`}
          oauthAvailable={isOAuthAvailable('slack')}
          oauthUnavailableReason={getUnavailableReason('slack')}
        />
      )}

      {activeDialog?.type === 'github' && (
        <GitHubConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          onStatusChanged={refreshConnections}
          oauthAvailable={availability?.integrations?.github?.oauthConfigured ?? false}
          oauthUnavailableReason={
            availability?.integrations?.github?.oauthConfigured === false
              ? 'Requires environment variables: GITHUB_APP_SLUG, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY'
              : undefined
          }
        />
      )}

      {activeDialog?.type === 'intercom' && (
        <IntercomConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          onStatusChanged={refreshConnections}
          oauthAvailable={isOAuthAvailable('intercom')}
          oauthUnavailableReason={getUnavailableReason('intercom')}
        />
      )}

      {activeDialog?.type === 'zendesk' && (
        <ZendeskConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          onStatusChanged={refreshConnections}
        />
      )}

      {activeDialog?.type === 'gong' && (
        <GongConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          onStatusChanged={refreshConnections}
        />
      )}

      {activeDialog?.type === 'posthog' && (
        <PosthogConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          onStatusChanged={refreshConnections}
        />
      )}

      {activeDialog?.type === 'jira' && (
        <JiraConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          onStatusChanged={refreshConnections}
          oauthAvailable={isOAuthAvailable('jira')}
          oauthUnavailableReason={getUnavailableReason('jira')}
        />
      )}

      {activeDialog?.type === 'linear' && (
        <LinearConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          onStatusChanged={refreshConnections}
          oauthAvailable={isOAuthAvailable('linear')}
          oauthUnavailableReason={getUnavailableReason('linear')}
        />
      )}

      {activeDialog?.type === 'notion' && (
        <NotionConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          onStatusChanged={refreshConnections}
          oauthAvailable={availability?.integrations?.notion?.oauthConfigured ?? false}
          oauthUnavailableReason={
            availability?.integrations?.notion?.oauthConfigured === false
              ? 'Requires environment variables: NOTION_CLIENT_ID, NOTION_CLIENT_SECRET'
              : undefined
          }
        />
      )}

      {activeDialog?.type === 'hubspot' && (
        <HubSpotConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          onStatusChanged={refreshConnections}
          oauthAvailable={isOAuthAvailable('hubspot')}
          oauthUnavailableReason={getUnavailableReason('hubspot')}
        />
      )}

      {activeDialog?.type === 'fathom' && (
        <FathomConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          onStatusChanged={refreshConnections}
        />
      )}
    </>
  )
}
