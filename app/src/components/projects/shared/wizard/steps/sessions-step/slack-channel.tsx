'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import { ChannelRow } from './channel-row'

interface SlackIntegration {
  isConnected: boolean
  isConnecting: boolean
  workspaceName?: string
  onConnect: () => void
  onDisconnect?: () => void
}

interface SlackChannelProps {
  integration: SlackIntegration
}

export function SlackChannel({ integration }: SlackChannelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div>
      <ChannelRow
        icon="/slack.svg"
        iconType="svg"
        name="Slack Agent"
        description="Connect Slack to receive and respond to customer sessions via your workspace"
        isExpanded={isExpanded}
        isConnected={integration.isConnected}
        isConnecting={integration.isConnecting}
        onToggle={() => setIsExpanded(!isExpanded)}
        onConnect={integration.onConnect}
      />

      {isExpanded && integration.isConnected && (
        <div className="mt-4 pl-8 space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-[color:var(--text-secondary)]">
              Connected to workspace:{' '}
              <span className="font-medium text-[color:var(--foreground)]">
                {integration.workspaceName || 'Unknown'}
              </span>
            </p>
            <p className="text-xs text-[color:var(--text-tertiary)]">
              Mention @hissuno in any channel to start a support session.
            </p>
          </div>

          {integration.onDisconnect && (
            <Button
              variant="danger"
              size="sm"
              onClick={integration.onDisconnect}
            >
              Disconnect Slack
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
