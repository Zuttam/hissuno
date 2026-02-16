'use client'

import { useState, useEffect, useCallback } from 'react'
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

type ChannelMode = 'interactive' | 'passive'
type CaptureScope = 'external_only' | 'all'

interface SlackChannel {
  id: string
  channelId: string
  channelName: string | null
  channelType: string
  channelMode: ChannelMode
  captureScope: CaptureScope
  joinedAt: string
}

interface AvailableChannel {
  id: string
  name: string
  numMembers: number
  topic: string | null
  purpose: string | null
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
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)
  const [updatingChannelId, setUpdatingChannelId] = useState<string | null>(null)
  const [leavingChannelId, setLeavingChannelId] = useState<string | null>(null)

  // Add channel state
  const [availableChannels, setAvailableChannels] = useState<AvailableChannel[]>([])
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(false)
  const [selectedChannelToJoin, setSelectedChannelToJoin] = useState<string>('')
  const [joiningChannel, setJoiningChannel] = useState(false)

  // Bulk mode state
  const [bulkModeUpdating, setBulkModeUpdating] = useState(false)

  // Modes explanation toggle
  const [showModesExplanation, setShowModesExplanation] = useState(false)

  // Add channel inline mode
  const [isAddingChannel, setIsAddingChannel] = useState(false)

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

  // Fetch channels when connected
  const fetchChannels = useCallback(async () => {
    if (!status.connected) return

    setIsLoadingChannels(true)
    try {
      const response = await fetch(`/api/integrations/slack/channels?projectId=${projectId}`)
      if (!response.ok) {
        throw new Error('Failed to load channels')
      }
      const data = await response.json()
      setChannels(data.channels || [])
    } catch (err) {
      console.error('[SlackConfigDialog] Failed to load channels:', err)
    } finally {
      setIsLoadingChannels(false)
    }
  }, [projectId, status.connected])

  useEffect(() => {
    if (status.connected) {
      void fetchChannels()
    }
  }, [status.connected, fetchChannels])

  // Fetch available channels to join
  const fetchAvailableChannels = useCallback(async () => {
    if (!status.connected) return

    setIsLoadingAvailable(true)
    try {
      const response = await fetch(`/api/integrations/slack/channels/available?projectId=${projectId}`)
      if (!response.ok) {
        throw new Error('Failed to load available channels')
      }
      const data = await response.json()
      setAvailableChannels(data.channels || [])
    } catch (err) {
      console.error('[SlackConfigDialog] Failed to load available channels:', err)
    } finally {
      setIsLoadingAvailable(false)
    }
  }, [projectId, status.connected])

  useEffect(() => {
    if (status.connected) {
      void fetchAvailableChannels()
    }
  }, [status.connected, fetchAvailableChannels])

  const handleUpdateChannelMode = async (
    channelId: string,
    mode: ChannelMode,
    captureScope?: CaptureScope
  ) => {
    setUpdatingChannelId(channelId)
    try {
      const response = await fetch('/api/integrations/slack/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelDbId: channelId,
          mode,
          captureScope,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update channel mode')
      }

      // Update local state
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === channelId
            ? { ...ch, channelMode: mode, captureScope: captureScope || ch.captureScope }
            : ch
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update channel mode')
    } finally {
      setUpdatingChannelId(null)
    }
  }

  const handleJoinChannel = async () => {
    if (!selectedChannelToJoin) return

    setJoiningChannel(true)
    setError(null)
    try {
      const response = await fetch('/api/integrations/slack/channels/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          channelId: selectedChannelToJoin,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to join channel')
      }

      // Refresh both channel lists
      setSelectedChannelToJoin('')
      await Promise.all([fetchChannels(), fetchAvailableChannels()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join channel')
    } finally {
      setJoiningChannel(false)
    }
  }

  const handleLeaveChannel = async (channelDbId: string) => {
    setLeavingChannelId(channelDbId)
    setError(null)
    try {
      const response = await fetch('/api/integrations/slack/channels/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          channelDbId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to leave channel')
      }

      // Refresh both channel lists
      await Promise.all([fetchChannels(), fetchAvailableChannels()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave channel')
    } finally {
      setLeavingChannelId(null)
    }
  }

  const handleBulkModeChange = async (mode: ChannelMode) => {
    if (channels.length === 0) return

    setBulkModeUpdating(true)
    setError(null)
    try {
      const response = await fetch('/api/integrations/slack/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          mode,
          applyToAll: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update channels')
      }

      // Update local state
      setChannels((prev) => prev.map((ch) => ({ ...ch, channelMode: mode })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update channels')
    } finally {
      setBulkModeUpdating(false)
    }
  }

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

  return (
    <Dialog open={open} onClose={onClose} title="Slack Integration" size="xxl">
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

            {/* Channel List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-[color:var(--foreground)]">
                    Configured Channels
                  </h4>
                  <button
                    onClick={() => {
                      void fetchChannels()
                      void fetchAvailableChannels()
                    }}
                    className="p-1 text-[color:var(--text-tertiary)] hover:text-[color:var(--foreground)] transition-colors"
                    title="Refresh channels"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 21h5v-5" />
                    </svg>
                  </button>
                </div>

                {/* Add Channel Button */}
                {isLoadingAvailable ? (
                  <Spinner size="sm" />
                ) : !isAddingChannel && availableChannels.length > 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsAddingChannel(true)}
                  >
                    Add
                  </Button>
                ) : null}
              </div>

              <p className="text-xs text-[color:var(--text-tertiary)]">
                Add a channel here or invite the bot directly from Slack with @hissuno.{' '}
                <button
                  onClick={() => setShowModesExplanation(!showModesExplanation)}
                  className="underline hover:text-[color:var(--foreground)] transition-colors"
                >
                  {showModesExplanation ? 'Hide modes' : 'Explain modes'}
                </button>
              </p>

              {showModesExplanation && (
                <div className="text-xs text-[color:var(--text-secondary)] ml-3">
                  <ul className="space-y-1 list-disc">
                    <li>
                      <strong>Interactive:</strong> Bot responds to @mentions and follows up in threads
                    </li>
                    <li>
                      <strong>Passive:</strong> Bot silently captures threads without responding
                    </li>
                  </ul>
                </div>
              )}

              {isLoadingChannels ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : channels.length === 0 && !isAddingChannel ? (
                <p className="text-sm text-[color:var(--text-secondary)]">
                  No channels configured yet.
                </p>
              ) : (channels.length > 0 || isAddingChannel) && (
                <>
                  {/* Bulk mode selector */}
                  <div className="flex items-center justify-between gap-3 px-2 py-1">
                    <span className="text-xs text-[color:var(--text-secondary)]">
                      Set all channels to:
                    </span>
                    <div className="flex items-center gap-2">
                      {bulkModeUpdating ? (
                        <Spinner size="sm" />
                      ) : (
                        <select
                          value=""
                          onChange={(e) => {
                            const mode = e.target.value as ChannelMode
                            if (mode) void handleBulkModeChange(mode)
                          }}
                          className="rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                        >
                          <option value="">Select mode...</option>
                          <option value="interactive">Interactive</option>
                          <option value="passive">Passive</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Channel rows */}
                  <div className="space-y-2">
                    {channels.map((channel) => (
                      <ChannelModeRow
                        key={channel.id}
                        channel={channel}
                        isUpdating={updatingChannelId === channel.id}
                        isLeaving={leavingChannelId === channel.id}
                        onUpdateMode={handleUpdateChannelMode}
                        onLeave={handleLeaveChannel}
                      />
                    ))}

                    {/* Inline add channel row */}
                    {isAddingChannel && (
                      <div className="flex items-center justify-between gap-3 rounded-[4px] border border-dashed border-[color:var(--accent-selected)] p-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[color:var(--text-tertiary)]">#</span>
                          <select
                            value={selectedChannelToJoin}
                            onChange={(e) => setSelectedChannelToJoin(e.target.value)}
                            autoFocus
                            className="flex-1 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                          >
                            <option value="">Select channel...</option>
                            {availableChannels.map((ch) => (
                              <option key={ch.id} value={ch.id}>
                                {ch.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {joiningChannel ? (
                            <Spinner size="sm" />
                          ) : (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={async () => {
                                  await handleJoinChannel()
                                  setIsAddingChannel(false)
                                }}
                                disabled={!selectedChannelToJoin}
                              >
                                Save
                              </Button>
                              <button
                                onClick={() => {
                                  setIsAddingChannel(false)
                                  setSelectedChannelToJoin('')
                                }}
                                className="p-1 text-[color:var(--text-tertiary)] hover:text-[color:var(--foreground)] transition-colors"
                                title="Cancel"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>


            {/* Danger Zone */}
            <div className="space-y-2 pt-2 border-t border-[color:var(--border-subtle)]">
              <h4 className="text-xs font-medium text-[color:var(--accent-danger)]">Danger Zone</h4>
              <Button variant="danger" onClick={handleDisconnect} loading={isDisconnecting}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="info">
              Connect your Slack workspace to capture customer conversations from specific channels.
            </Alert>
            <Button variant="primary" onClick={handleConnect}>
              Connect Slack
            </Button>
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

/**
 * Individual channel row with mode selector and leave button
 */
function ChannelModeRow({
  channel,
  isUpdating,
  isLeaving,
  onUpdateMode,
  onLeave,
}: {
  channel: SlackChannel
  isUpdating: boolean
  isLeaving: boolean
  onUpdateMode: (channelId: string, mode: ChannelMode, captureScope?: CaptureScope) => void
  onLeave: (channelId: string) => void
}) {
  const channelIcon = channel.channelType === 'private_channel' ? '🔒' : '#'

  return (
    <div className="flex items-center justify-between gap-3 rounded-[4px] border border-[color:var(--border-subtle)] p-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[color:var(--text-tertiary)]">{channelIcon}</span>
        <span className="text-sm truncate">{channel.channelName || channel.channelId}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isUpdating || isLeaving ? (
          <Spinner size="sm" />
        ) : (
          <>
            {/* Mode Selector */}
            <select
              value={channel.channelMode}
              onChange={(e) => {
                const newMode = e.target.value as ChannelMode
                onUpdateMode(channel.id, newMode, channel.captureScope)
              }}
              className="rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
            >
              <option value="interactive">Interactive</option>
              <option value="passive">Passive</option>
            </select>

            {/* Capture Scope Selector (only for passive mode) */}
            {channel.channelMode === 'passive' && (
              <select
                value={channel.captureScope}
                onChange={(e) => {
                  const newScope = e.target.value as CaptureScope
                  onUpdateMode(channel.id, channel.channelMode, newScope)
                }}
                className="rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
              >
                <option value="external_only">External only</option>
                <option value="all">All threads</option>
              </select>
            )}

            {/* Leave Channel Button */}
            <button
              onClick={() => onLeave(channel.id)}
              className="p-1 text-[color:var(--text-tertiary)] hover:text-[color:var(--accent-danger)] transition-colors"
              title="Leave channel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
