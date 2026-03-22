'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Check, Unplug, Shield, KeyRound, Plug } from 'lucide-react'
import { Dialog, Button, InlineAlert, Spinner } from '@/components/ui'
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
    <Dialog open={open} onClose={onClose} title="Notion Integration" size="lg">
      <div className="flex flex-col gap-6">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status.connected ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm text-[color:var(--accent-success)]"><Check size={14} />Connected to {status.workspaceName || 'Unknown'} <span className="text-xs opacity-75">via {authMethodLabel}</span></p>
              {status.authMethod === 'token' && (
                <InlineAlert variant="attention">
                  Internal integrations can only access pages explicitly shared with them.{' '}
                  <a
                    href="https://www.notion.so/help/add-and-manage-connections-with-the-api#add-connections-to-pages"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-[color:var(--foreground)]"
                  >
                    Learn more
                  </a>
                </InlineAlert>
              )}
            </div>

            <p className="text-sm text-[color:var(--text-secondary)]">
              You can now import Notion pages as knowledge sources from the{' '}
              <Link
                href={`/projects/${projectId}/knowledge#sources`}
                className="underline hover:text-[color:var(--foreground)]"
                onClick={onClose}
              >
                Knowledge page
              </Link>.
            </p>

            {/* Danger Zone */}
            <div className="border-t border-[color:var(--accent-danger)] pt-4">
              <p className="font-mono text-xs font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">Danger Zone</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                This will remove the Notion connection. Previously imported pages will remain as knowledge sources.
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
              Connect your Notion workspace to import pages as knowledge sources.
            </InlineAlert>

            {/* Connection Method Toggle */}
            <ToggleGroup
              value={connectionMethod}
              onChange={setConnectionMethod}
              options={[
                { value: 'oauth' as const, label: 'OAuth', icon: <Shield size={14} /> },
                { value: 'token' as const, label: 'Integration Token', icon: <KeyRound size={14} /> },
              ]}
            />

            {connectionMethod === 'oauth' ? (
              <div className="space-y-4">
                {oauthAvailable === false ? (
                  <InlineAlert variant="attention">
                    OAuth is not configured on this instance. {oauthUnavailableReason} Use the Integration Token method instead.
                  </InlineAlert>
                ) : (
                  <>
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      Connect with one click using your Notion account. You&apos;ll be redirected to Notion to authorize access.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        window.location.href = notionConnectUrl(projectId)
                      }}
                    >
                      <Plug size={14} />
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

                <Button variant="primary" size="sm" onClick={handleConnectToken} loading={isConnecting}>
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
