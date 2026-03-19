'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, Button, Alert, Spinner } from '@/components/ui'
import { ToggleGroup } from '@/components/ui/toggle-group'
import {
  fetchNotionStatus,
  disconnectNotion,
  notionConnectUrl,
  connectNotionToken,
} from '@/lib/api/integrations'

interface NotionConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
  oauthAvailable?: boolean
  oauthUnavailableReason?: string
}

interface NotionStatus {
  connected: boolean
  workspaceName?: string | null
  workspaceId?: string | null
  authMethod?: 'oauth' | 'token' | null
}

export function NotionConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
  oauthAvailable,
  oauthUnavailableReason,
}: NotionConfigDialogProps) {
  const [status, setStatus] = useState<NotionStatus>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // Connection method toggle
  const [connectionMethod, setConnectionMethod] = useState<'oauth' | 'token'>(
    oauthAvailable === false ? 'token' : 'oauth'
  )

  // Token form state
  const [accessToken, setAccessToken] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchNotionStatus(projectId)
      if (!response.ok) {
        throw new Error('Failed to load Notion status')
      }
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Notion status')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) {
      void fetchStatus()
    }
  }, [open, fetchStatus])

  const handleConnectToken = async () => {
    if (!accessToken.trim()) {
      setError('Integration token is required.')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const response = await connectNotionToken({
        projectId,
        accessToken: accessToken.trim(),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Notion')
      }

      setAccessToken('')
      setStatus({ connected: true, workspaceName: data.workspaceName, authMethod: 'token' })
      onStatusChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Notion')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await disconnectNotion(projectId)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect Notion')
      }

      setStatus({ connected: false })
      onStatusChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Notion')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const authMethodLabel = status.authMethod === 'token' ? 'Integration Token' : 'OAuth'

  return (
    <Dialog open={open} onClose={onClose} title="Notion Integration" size="md">
      <div className="flex flex-col gap-6">
        {error && <Alert variant="danger">{error}</Alert>}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status.connected ? (
          <div className="space-y-6">
            <Alert variant="success">
              Connected to workspace: <strong>{status.workspaceName || 'Unknown'}</strong>
              <span className="text-xs ml-2 opacity-75">via {authMethodLabel}</span>
            </Alert>

            <p className="text-sm text-[color:var(--text-secondary)]">
              You can now import Notion pages as knowledge sources from the Configuration page.
            </p>

            {/* Danger Zone */}
            <div className="space-y-2 pt-2 border-t border-[color:var(--border-subtle)]">
              <h4 className="text-xs font-medium text-[color:var(--accent-danger)]">Danger Zone</h4>
              <Button variant="danger" onClick={handleDisconnect} loading={isDisconnecting}>
                Disconnect
              </Button>
              <p className="text-xs text-[color:var(--text-tertiary)]">
                This will remove the Notion connection. Previously imported pages will remain as knowledge sources.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Alert variant="info">
              Connect your Notion workspace to import pages as knowledge sources.
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
                  { value: 'oauth' as const, label: 'OAuth' },
                  { value: 'token' as const, label: 'Integration Token' },
                ]}
              />
            </div>

            {connectionMethod === 'oauth' ? (
              <div className="space-y-4">
                {oauthAvailable === false ? (
                  <Alert variant="warning">
                    OAuth is not configured on this instance. {oauthUnavailableReason} Use the Integration Token method instead.
                  </Alert>
                ) : (
                  <>
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      Connect with one click using your Notion account. You&apos;ll be redirected to Notion to authorize access.
                    </p>
                    <Button
                      variant="primary"
                      onClick={() => {
                        window.location.href = notionConnectUrl(projectId)
                      }}
                    >
                      Connect with Notion
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Connect using a Notion Internal Integration Token. No OAuth environment variables needed.
                </p>

                {/* Integration Token */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[color:var(--foreground)]">
                    Internal Integration Token
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => {
                      setAccessToken(e.target.value)
                      setError(null)
                    }}
                    placeholder="ntn_... or secret_..."
                    className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                  />
                  <p className="text-xs text-[color:var(--text-tertiary)]">
                    Create an internal integration at{' '}
                    <a
                      href="https://www.notion.so/profile/integrations"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-[color:var(--foreground)]"
                    >
                      notion.so/profile/integrations
                    </a>{' '}
                    and share your pages with it.
                  </p>
                </div>

                <Button variant="primary" onClick={handleConnectToken} loading={isConnecting}>
                  Connect
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[color:var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
