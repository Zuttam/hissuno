'use client'

import { useState, useEffect } from 'react'
import { Dialog, Button, Alert, Spinner } from '@/components/ui'

interface GitHubConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
}

interface GitHubStatus {
  connected: boolean
  accountLogin?: string | null
}

export function GitHubConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
}: GitHubConfigDialogProps) {
  const [status, setStatus] = useState<GitHubStatus>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch current GitHub connection status
  useEffect(() => {
    if (!open) return

    const fetchStatus = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/integrations/github?projectId=${projectId}`)
        if (!response.ok) {
          throw new Error('Failed to load GitHub status')
        }
        const data = await response.json()
        setStatus({
          connected: data.connected,
          accountLogin: data.accountLogin,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load GitHub status')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchStatus()
  }, [open, projectId])

  const handleConnect = () => {
    // Open GitHub OAuth flow in a new window
    const returnUrl = `/projects/${projectId}/integrations`
    window.open(
      `/api/integrations/github/connect?projectId=${projectId}&returnUrl=${encodeURIComponent(returnUrl)}`,
      '_blank'
    )
    // Dialog stays open - user can check back after connecting
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await fetch(`/api/integrations/github?projectId=${projectId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect GitHub')
      }

      setStatus({ connected: false })
      onStatusChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect GitHub')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/integrations/github?projectId=${projectId}`)
      if (!response.ok) {
        throw new Error('Failed to load GitHub status')
      }
      const data = await response.json()
      setStatus({
        connected: data.connected,
        accountLogin: data.accountLogin,
      })
      if (data.connected) {
        onStatusChanged?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GitHub status')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="GitHub Integration" size="md">
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
              Connected to GitHub: <strong>{status.accountLogin || 'Unknown'}</strong>
            </Alert>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Your codebase is connected for knowledge analysis.
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
              Connect your GitHub repository to analyze your codebase and generate product knowledge.
            </Alert>
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={handleConnect}>
                Connect GitHub
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
