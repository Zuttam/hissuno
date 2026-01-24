'use client'

import { useState, useEffect } from 'react'
import { Dialog, Button, Alert, Spinner } from '@/components/ui'

interface SlackConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
  /** URL to redirect to after OAuth completes (e.g., /projects/{id}/integrations) */
  nextUrl?: string
}

interface SlackStatus {
  connected: boolean
  workspaceName?: string
}

export function SlackConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
  nextUrl,
}: SlackConfigDialogProps) {
  const [status, setStatus] = useState<SlackStatus>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch current Slack connection status
  useEffect(() => {
    if (!open) return

    const fetchStatus = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/integrations/slack?projectId=${projectId}`)
        if (!response.ok) {
          throw new Error('Failed to load Slack status')
        }
        const data = await response.json()
        setStatus({
          connected: data.connected,
          workspaceName: data.workspaceName,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Slack status')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchStatus()
  }, [open, projectId])

  const handleConnect = () => {
    // Open Slack OAuth flow in a new window
    const url = nextUrl
      ? `/api/integrations/slack/connect?projectId=${projectId}&nextUrl=${encodeURIComponent(nextUrl)}`
      : `/api/integrations/slack/connect?projectId=${projectId}`
    window.open(url, '_blank')
    // Dialog stays open - user can check back after connecting
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await fetch(`/api/integrations/slack?projectId=${projectId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect Slack')
      }

      setStatus({ connected: false })
      onStatusChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Slack')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/integrations/slack?projectId=${projectId}`)
      if (!response.ok) {
        throw new Error('Failed to load Slack status')
      }
      const data = await response.json()
      setStatus({
        connected: data.connected,
        workspaceName: data.workspaceName,
      })
      if (data.connected) {
        onStatusChanged?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Slack status')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Slack Integration" size="md">
      <div className="flex flex-col gap-6">
        {error && (
          <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-3 font-mono text-sm text-[color:var(--accent-danger)]">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status.connected ? (
          <div className="space-y-4">
            <Alert variant="success">
              Connected to workspace: <strong>{status.workspaceName || 'Unknown'}</strong>
            </Alert>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Mention @hissuno in any channel to start a support session.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="danger" onClick={handleDisconnect} loading={isDisconnecting}>
                Disconnect
              </Button>
              <Button variant="secondary" onClick={handleRefresh}>
                Refresh Status
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="info">
              Connect your Slack workspace to capture customer conversations from specific channels.
            </Alert>
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={handleConnect}>
                Connect Slack
              </Button>
              <Button variant="secondary" onClick={handleRefresh}>
                Refresh Status
              </Button>
            </div>
            <p className="text-xs text-[color:var(--text-tertiary)]">
              After connecting, return here and click &quot;Refresh Status&quot; to verify the connection.
            </p>
          </div>
        )}

        {/* Footer with Close */}
        <div className="flex items-center justify-end border-t border-[color:var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
