'use client'

import Image from 'next/image'
import { Button } from '@/components/ui'

interface ChannelRowProps {
  icon: string
  name: string
  description?: string
  isExpanded: boolean
  isConnected?: boolean
  isConnecting?: boolean
  comingSoon?: boolean
  iconType?: 'emoji' | 'svg'
  onToggle: () => void
  onConnect?: () => void
}

export function ChannelRow({
  icon,
  name,
  description,
  isExpanded,
  isConnected = true,
  isConnecting = false,
  comingSoon = false,
  iconType = 'emoji',
  onToggle,
  onConnect,
}: ChannelRowProps) {
  const showConnect = !isConnected && onConnect && !comingSoon

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        {iconType === 'svg' ? (
          <Image src={icon} alt={name} width={24} height={24} className="flex-shrink-0" />
        ) : (
          <span className="text-xl">{icon}</span>
        )}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[color:var(--foreground)]">{name}</span>
            {comingSoon && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--background-secondary)] text-[color:var(--text-secondary)]">
                Coming Soon
              </span>
            )}
          </div>
          {description && (
            <span className="text-sm text-[color:var(--text-secondary)]">{description}</span>
          )}
        </div>
      </div>
      {comingSoon ? null : showConnect ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onConnect}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={onToggle}>
          {isExpanded ? 'Close' : 'Configure'}
        </Button>
      )}
    </div>
  )
}
