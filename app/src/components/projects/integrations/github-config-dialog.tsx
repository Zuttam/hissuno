'use client'

import { useState, useEffect } from 'react'
import { Dialog, Button, Alert, Spinner } from '@/components/ui'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { fetchGithubStatus, disconnectGithub, githubConnectUrl, connectGithubPat } from '@/lib/api/integrations'

interface GitHubConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
  /** Whether OAuth env vars are configured on this instance */
  oauthAvailable?: boolean
  /** Human-readable reason when OAuth is unavailable */
  oauthUnavailableReason?: string
}

interface GitHubStatus {
  connected: boolean
  accountLogin?: string | null
  authMethod?: 'app' | 'pat' | null
}

export function GitHubConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
  oauthAvailable,
  oauthUnavailableReason,
}: GitHubConfigDialogProps) {
  const [status, setStatus] = useState<GitHubStatus>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [connectClicked, setConnectClicked] = useState(false)

  // Connection method toggle
  const [connectionMethod, setConnectionMethod] = useState<'app' | 'pat'>(
    oauthAvailable === false ? 'pat' : 'app'
  )

  // PAT form state
  const [accessToken, setAccessToken] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  // Fetch current GitHub connection status
  useEffect(() => {
    if (!open) return

    const fetchStatus = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetchGithubStatus(projectId)
        if (!response.ok) {
          throw new Error('Failed to load GitHub status')
        }
        const data = await response.json()
        setStatus({
          connected: data.connected,
          accountLogin: data.accountLogin,
          authMethod: data.authMethod,
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
    window.open(githubConnectUrl(projectId, returnUrl), '_blank')
    setConnectClicked(true)
  }

  const handleConnectPat = async () => {
    if (!accessToken.trim()) {
      setError('Access token is required.')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const response = await connectGithubPat({
        projectId,
        accessToken: accessToken.trim(),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect GitHub')
      }

      setAccessToken('')
      setStatus({ connected: true, accountLogin: data.accountLogin, authMethod: 'pat' })
      setSuccessMessage('GitHub connected successfully.')
      onStatusChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect GitHub')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await disconnectGithub(projectId)

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
      const response = await fetchGithubStatus(projectId)
      if (!response.ok) {
        throw new Error('Failed to load GitHub status')
      }
      const data = await response.json()
      setStatus({
        connected: data.connected,
        accountLogin: data.accountLogin,
        authMethod: data.authMethod,
      })
      if (data.connected) {
        setSuccessMessage('GitHub connection verified.')
        onStatusChanged?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GitHub status')
    } finally {
      setIsLoading(false)
    }
  }

  const authMethodLabel = status.authMethod === 'pat' ? 'Access Token' : 'GitHub App'

  return (
    <Dialog open={open} onClose={onClose} title="GitHub Integration" size="md">
      <div className="flex flex-col gap-6">
        {error && <Alert variant="danger">{error}</Alert>}
        {successMessage && <Alert variant="success">{successMessage}</Alert>}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status.connected ? (
          <div className="space-y-4">
            <Alert variant="success">
              &#10003; Connected to GitHub: <strong>{status.accountLogin || 'Unknown'}</strong>
              <span className="text-xs ml-2 opacity-75">via {authMethodLabel}</span>
            </Alert>
            <Button variant="secondary" onClick={handleRefresh}>
              Refresh Status
            </Button>

            {/* Danger Zone */}
            <div className="space-y-2 pt-2 border-t border-[color:var(--border-subtle)]">
              <h4 className="text-xs font-medium text-[color:var(--accent-danger)]">Danger Zone</h4>
              <Button variant="danger" onClick={handleDisconnect} loading={isDisconnecting}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Alert variant="info">
              Connect your GitHub repository to analyze your codebase and generate product knowledge.
            </Alert>

            {/* Connection Method Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--foreground)]">
                Connection Method
              </label>
              <ToggleGroup
                value={connectionMethod}
                onChange={setConnectionMethod}
                options={[
                  { value: 'app' as const, label: 'GitHub App' },
                  { value: 'pat' as const, label: 'Access Token' },
                ]}
              />
            </div>

            {connectionMethod === 'app' ? (
              <div className="space-y-4">
                {oauthAvailable === false ? (
                  <Alert variant="warning">
                    OAuth is not configured on this instance. {oauthUnavailableReason} Use the Access Token method instead.
                  </Alert>
                ) : (
                  <>
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      Connect via a GitHub App with OAuth. You&apos;ll be redirected to GitHub to authorize access.
                    </p>
                    <div className="flex items-center gap-3">
                      <Button variant="primary" onClick={handleConnect}>
                        Connect GitHub
                      </Button>
                      {connectClicked && (
                        <Button variant="secondary" onClick={handleRefresh}>
                          Refresh Status
                        </Button>
                      )}
                    </div>
                    {connectClicked && (
                      <p className="text-xs text-[color:var(--text-tertiary)]">
                        After connecting, return here and click &quot;Refresh Status&quot; to verify the connection.
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Connect using a GitHub Personal Access Token. No GitHub App or environment variables needed.
                </p>

                {/* Access Token */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[color:var(--foreground)]">
                    Personal Access Token
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => {
                      setAccessToken(e.target.value)
                      setError(null)
                    }}
                    placeholder="ghp_... or github_pat_..."
                    className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                  />
                  <p className="text-xs text-[color:var(--text-tertiary)]">
                    Create a token at{' '}
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-[color:var(--foreground)]"
                    >
                      github.com/settings/tokens
                    </a>{' '}
                    with <code className="text-xs">repo</code> scope.
                  </p>
                </div>

                <Button variant="primary" onClick={handleConnectPat} loading={isConnecting}>
                  Connect
                </Button>
              </div>
            )}
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
