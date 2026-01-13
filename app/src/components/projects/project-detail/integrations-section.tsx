'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import type { IntegrationStats } from '@/lib/supabase/sessions'
import { Collapsible } from '@/components/ui'

type IntegrationStatus = 'inactive' | 'idle' | 'active'

type SlackIntegrationState = {
  connected: boolean
  workspaceName: string | null
  isLoading: boolean
  error: string | null
}

type GitHubIntegrationState = {
  connected: boolean
  accountLogin: string | null
  isLoading: boolean
  error: string | null
}

interface IntegrationsSectionProps {
  project: ProjectWithCodebase & {
    secret_key?: string | null
    allowed_origins?: string[] | null
  }
  integrationStats: IntegrationStats | null
  isLoading?: boolean
}

function getIntegrationStatus(hasRecentActivity: boolean): IntegrationStatus {
  // Widget is always configured since we use projectId
  if (!hasRecentActivity) return 'idle'
  return 'active'
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function IntegrationsSection({ project, integrationStats, isLoading }: IntegrationsSectionProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [slackState, setSlackState] = useState<SlackIntegrationState>({
    connected: false,
    workspaceName: null,
    isLoading: true,
    error: null,
  })
  const [githubState, setGithubState] = useState<GitHubIntegrationState>({
    connected: false,
    accountLogin: null,
    isLoading: true,
    error: null,
  })

  // Fetch Slack integration status
  const fetchSlackStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/integrations/slack?projectId=${project.id}`)
      if (response.ok) {
        const data = await response.json()
        setSlackState({
          connected: data.connected,
          workspaceName: data.workspaceName,
          isLoading: false,
          error: null,
        })
      } else {
        setSlackState((prev) => ({ ...prev, isLoading: false }))
      }
    } catch {
      setSlackState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [project.id])

  // Fetch GitHub integration status
  const fetchGitHubStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/integrations/github?projectId=${project.id}`)
      if (response.ok) {
        const data = await response.json()
        setGithubState({
          connected: data.connected,
          accountLogin: data.accountLogin,
          isLoading: false,
          error: null,
        })
      } else {
        setGithubState((prev) => ({ ...prev, isLoading: false }))
      }
    } catch {
      setGithubState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [project.id])

  useEffect(() => {
    fetchSlackStatus()
    fetchGitHubStatus()
  }, [fetchSlackStatus, fetchGitHubStatus])

  // Check for success/error from OAuth callbacks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)

    // Slack callback
    const slackSuccess = urlParams.get('slack')
    const slackError = urlParams.get('slack_error')

    if (slackSuccess === 'connected') {
      fetchSlackStatus()
      const url = new URL(window.location.href)
      url.searchParams.delete('slack')
      window.history.replaceState({}, '', url.toString())
    }

    if (slackError) {
      setSlackState((prev) => ({ ...prev, error: slackError }))
      const url = new URL(window.location.href)
      url.searchParams.delete('slack_error')
      window.history.replaceState({}, '', url.toString())
    }

    // GitHub callback
    const githubSuccess = urlParams.get('github')
    const githubError = urlParams.get('github_error')

    if (githubSuccess === 'connected') {
      fetchGitHubStatus()
      const url = new URL(window.location.href)
      url.searchParams.delete('github')
      window.history.replaceState({}, '', url.toString())
    }

    if (githubError) {
      setGithubState((prev) => ({ ...prev, error: githubError }))
      const url = new URL(window.location.href)
      url.searchParams.delete('github_error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [fetchSlackStatus, fetchGitHubStatus])

  const handleConnectSlack = () => {
    window.location.href = `/api/integrations/slack/connect?projectId=${project.id}`
  }

  const handleDisconnectSlack = async () => {
    if (!confirm('Are you sure you want to disconnect Slack?')) {
      return
    }

    setSlackState((prev) => ({ ...prev, isLoading: true }))

    try {
      const response = await fetch(`/api/integrations/slack?projectId=${project.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSlackState({
          connected: false,
          workspaceName: null,
          isLoading: false,
          error: null,
        })
      } else {
        const data = await response.json()
        setSlackState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || 'Failed to disconnect',
        }))
      }
    } catch {
      setSlackState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to disconnect',
      }))
    }
  }

  const handleConnectGitHub = () => {
    window.location.href = `/api/integrations/github/connect?projectId=${project.id}`
  }

  const handleDisconnectGitHub = async () => {
    if (!confirm('Are you sure you want to disconnect GitHub?')) {
      return
    }

    setGithubState((prev) => ({ ...prev, isLoading: true }))

    try {
      const response = await fetch(`/api/integrations/github?projectId=${project.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setGithubState({
          connected: false,
          accountLogin: null,
          isLoading: false,
          error: null,
        })
      } else {
        const data = await response.json()
        setGithubState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || 'Failed to disconnect',
        }))
      }
    } catch {
      setGithubState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to disconnect',
      }))
    }
  }

  const copyToClipboard = async (value: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-4 border-t border-[color:var(--border-subtle)]">
        <div className="animate-pulse flex gap-6">
          <div className="h-4 w-32 rounded bg-[color:var(--surface-hover)]" />
          <div className="h-4 w-24 rounded bg-[color:var(--surface-hover)]" />
        </div>
      </div>
    )
  }

  const hasRecentActivity = integrationStats?.isActive ?? false
  const widgetStatus = getIntegrationStatus(hasRecentActivity)

  return (
    <div className="flex flex-col gap-4">
      {/* Widget Integration */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <StatusIndicator status={widgetStatus} />
          <span className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Widget Integration
          </span>
          {/* Last activity */}
          {integrationStats?.lastActivityAt && (
            <span className="text-xs text-[color:var(--text-tertiary)]">
              · Last: {formatRelativeTime(integrationStats.lastActivityAt)}
            </span>
          )}
        </div>

        <Collapsible
          trigger="View code"
          headerActions={
            <button
              type="button"
              onClick={() => copyToClipboard(generateSnippet(project.id), 'snippet')}
              className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
            >
              {copiedField === 'snippet' ? 'Copied!' : 'Copy'}
            </button>
          }
          className="flex-1"
        >
          <pre className="overflow-x-auto rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3 text-xs font-mono text-[color:var(--foreground)]">
            <code>{generateSnippet(project.id)}</code>
          </pre>
        </Collapsible>
      </div>

      {/* GitHub Integration */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <StatusIndicator status={githubState.connected ? 'active' : 'inactive'} />
          <span className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            GitHub Integration
          </span>
          {githubState.connected && githubState.accountLogin && (
            <span className="text-xs text-[color:var(--text-tertiary)]">
              · {githubState.accountLogin}
            </span>
          )}
        </div>

        {githubState.isLoading ? (
          <span className="text-xs text-[color:var(--text-tertiary)]">Loading...</span>
        ) : githubState.connected ? (
          <button
            type="button"
            onClick={handleDisconnectGitHub}
            className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] transition hover:border-red-500 hover:text-red-500"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnectGitHub}
            className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
          >
            Connect
          </button>
        )}

        {githubState.error && (
          <span className="text-xs text-red-500">{githubState.error}</span>
        )}
      </div>

      {/* Slack Integration */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <StatusIndicator status={slackState.connected ? 'active' : 'inactive'} />
          <span className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Slack Integration
          </span>
          {slackState.connected && slackState.workspaceName && (
            <span className="text-xs text-[color:var(--text-tertiary)]">
              · {slackState.workspaceName}
            </span>
          )}
        </div>

        {slackState.isLoading ? (
          <span className="text-xs text-[color:var(--text-tertiary)]">Loading...</span>
        ) : slackState.connected ? (
          <button
            type="button"
            onClick={handleDisconnectSlack}
            className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] transition hover:border-red-500 hover:text-red-500"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnectSlack}
            className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
          >
            Connect
          </button>
        )}

        {slackState.error && (
          <span className="text-xs text-red-500">{slackState.error}</span>
        )}
      </div>
    </div>
  )
}

function StatusIndicator({ status }: { status: IntegrationStatus }) {
  const colorClass = {
    inactive: 'bg-[color:var(--text-tertiary)]', // Gray
    idle: 'bg-amber-500',                         // Yellow
    active: 'bg-emerald-500',                     // Green
  }[status]

  return <span className={`h-2 w-2 rounded-full ${colorClass}`} />
}

function generateSnippet(projectId: string): string {
  return `import { HissunoWidget } from '@hissuno/widget';

<HissunoWidget
  projectId="${projectId}"
/>`
}
