'use client'

import { useState, useEffect } from 'react'
import { Check, Unplug, Shield, KeyRound, Plug } from 'lucide-react'
import { Dialog, Button, InlineAlert, Spinner, FormField, Input } from '@/components/ui'
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
    <Dialog open={open} onClose={onClose} title="GitHub Integration" size="lg">
      <div className="flex flex-col gap-6">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        {successMessage && <InlineAlert variant="success">{successMessage}</InlineAlert>}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status.connected ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-[color:var(--accent-success)]"><Check size={14} />Connected to GitHub: {status.accountLogin || 'Unknown'} <span className="text-xs opacity-75">via {authMethodLabel}</span></p>
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              Refresh Status
            </Button>

            {/* Danger Zone */}
            <div className="border-t border-[color:var(--accent-danger)] pt-4">
              <p className="font-mono text-xs font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">Danger Zone</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                This will remove the GitHub connection.
              </p>
              <Button
                variant="danger"
                size="sm"
                className="mt-3"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                loading={isDisconnecting}
              >
                <Unplug size={14} />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <InlineAlert variant="info">
              Connect your GitHub repository to analyze your codebase and generate product knowledge.
            </InlineAlert>

            {/* Connection Method Toggle */}
            <ToggleGroup
              value={connectionMethod}
              onChange={setConnectionMethod}
              options={[
                { value: 'app' as const, label: 'GitHub App', icon: <Shield size={14} /> },
                { value: 'pat' as const, label: 'Access Token', icon: <KeyRound size={14} /> },
              ]}
            />

            {connectionMethod === 'app' ? (
              <div className="space-y-4">
                {oauthAvailable === false ? (
                  <InlineAlert variant="attention">
                    OAuth is not configured on this instance. {oauthUnavailableReason} Use the Access Token method instead.
                  </InlineAlert>
                ) : (
                  <>
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      Connect via a GitHub App with OAuth. You&apos;ll be redirected to GitHub to authorize access.
                    </p>
                    <div className="flex items-center gap-3">
                      <Button variant="primary" size="sm" onClick={handleConnect}>
                        <Plug size={14} />
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
                <FormField
                  label="Personal Access Token"
                  supportingText={<>Create a token at{' '}
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-[color:var(--foreground)]"
                    >
                      github.com/settings/tokens
                    </a>{' '}
                    with <code className="text-xs">repo</code> scope.</>}
                >
                  <Input
                    type="password"
                    value={accessToken}
                    onChange={(e) => {
                      setAccessToken(e.target.value)
                      setError(null)
                    }}
                    placeholder="ghp_... or github_pat_..."
                  />
                </FormField>

                <Button variant="primary" size="sm" onClick={handleConnectPat} loading={isConnecting}>
                  <Plug size={14} />
                  Connect
                </Button>
              </div>
            )}
          </div>
        )}

      </div>
    </Dialog>
  )
}
