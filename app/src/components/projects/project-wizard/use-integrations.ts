'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ProjectIntegrations, ProjectWizardMode, ProjectStepId } from '../shared/wizard/steps'

interface UseIntegrationsProps {
  mode: ProjectWizardMode
  projectId?: string
  currentStepId: ProjectStepId
  onBeforeOAuth: () => void
  onGitHubDisconnect?: () => void
}

export function useIntegrations({
  mode,
  projectId,
  currentStepId,
  onBeforeOAuth,
  onGitHubDisconnect,
}: UseIntegrationsProps): ProjectIntegrations {
  // GitHub state
  const [githubConnected, setGithubConnected] = useState(false)
  const [githubConnecting, setGithubConnecting] = useState(false)
  const [githubInstallationId, setGithubInstallationId] = useState<number | null>(null)

  // Slack state
  const [slackConnected, setSlackConnected] = useState(false)
  const [slackConnecting, setSlackConnecting] = useState(false)
  const [slackWorkspaceName, setSlackWorkspaceName] = useState<string | undefined>()

  const searchParams = useSearchParams()

  // Check GitHub integration status
  useEffect(() => {
    // Fetch status if in edit mode OR if we just returned from GitHub OAuth
    const justConnected = searchParams.get('github') === 'connected'
    if ((mode === 'edit' || justConnected) && projectId) {
      fetch(`/api/integrations/github?projectId=${projectId}`)
        .then((res) => res.json())
        .then((data) => {
          setGithubConnected(data.connected)
          setGithubInstallationId(data.installationId ?? null)
          setGithubConnecting(false)
        })
        .catch(() => {
          setGithubConnecting(false)
        })
    }
  }, [mode, projectId, searchParams])

  // Check Slack integration status for edit mode
  useEffect(() => {
    if (mode === 'edit' && projectId) {
      fetch(`/api/integrations/slack?projectId=${projectId}`)
        .then((res) => res.json())
        .then((data) => {
          setSlackConnected(data.connected)
          setSlackWorkspaceName(data.workspaceName)
        })
        .catch(() => {})
    }
  }, [mode, projectId])

  const handleGitHubConnect = useCallback(() => {
    setGithubConnecting(true)
    onBeforeOAuth() // Save form state

    // Build OAuth URL with step parameter (same pattern as Slack)
    const params = new URLSearchParams()
    if (projectId) {
      params.set('projectId', projectId)
    }
    params.set('returnStep', currentStepId)
    params.set('mode', mode)

    window.location.href = `/api/integrations/github/connect?${params.toString()}`
  }, [mode, projectId, currentStepId, onBeforeOAuth])

  const handleGitHubDisconnect = useCallback(async () => {
    if (!projectId) return

    try {
      const response = await fetch(`/api/integrations/github?projectId=${projectId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setGithubConnected(false)
        onGitHubDisconnect?.()
      }
    } catch {
      // Silently fail - user can try again
    }
  }, [projectId, onGitHubDisconnect])

  const handleSlackConnect = useCallback(() => {
    setSlackConnecting(true)
    onBeforeOAuth() // Save form state

    // Build OAuth URL with step parameter
    const params = new URLSearchParams()
    if (projectId) {
      params.set('projectId', projectId)
    }
    params.set('returnStep', currentStepId)
    params.set('mode', mode)

    window.location.href = `/api/integrations/slack/connect?${params.toString()}`
  }, [mode, projectId, currentStepId, onBeforeOAuth])

  const handleSlackDisconnect = useCallback(async () => {
    if (!projectId) return

    try {
      const response = await fetch(`/api/integrations/slack?projectId=${projectId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSlackConnected(false)
        setSlackWorkspaceName(undefined)
      }
    } catch {
      // Silently fail - user can try again
    }
  }, [projectId])

  return {
    github: {
      isConnected: githubConnected,
      isConnecting: githubConnecting,
      installationId: githubInstallationId,
      onConnect: handleGitHubConnect,
      onDisconnect: handleGitHubDisconnect,
    },
    slack: {
      isConnected: slackConnected,
      isConnecting: slackConnecting,
      onConnect: handleSlackConnect,
      onDisconnect: handleSlackDisconnect,
      workspaceName: slackWorkspaceName,
    },
  }
}
