'use client'

import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Heading, Button } from '@/components/ui'
import type { IntegrationStatuses } from '@/hooks/use-integration-statuses'

interface ChannelIndicator {
  id: string
  logo: string | null
  label: string
  active: boolean
  comingSoon?: boolean
}

interface KnowledgeRowConfig {
  label: string
  meta: string
  onClick: (e: React.MouseEvent) => void
}

interface AgentCardProps {
  title: string
  description: string
  avatar: string
  channels: ChannelIndicator[]
  destinations?: ChannelIndicator[]
  onClick: () => void
  knowledgeRow?: KnowledgeRowConfig
}

function ChannelIcon({ channel }: { channel: ChannelIndicator }) {
  const opacity = channel.active ? 'opacity-100' : 'opacity-30'
  const title = channel.comingSoon
    ? `${channel.label} (coming soon)`
    : channel.active
      ? `${channel.label} (connected)`
      : `${channel.label} (not connected)`

  if (!channel.logo) {
    // Widget uses an SVG inline icon since it has no logo file
    return (
      <span className={`${opacity} flex items-center justify-center`} title={title}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </span>
    )
  }

  return (
    <span className={opacity} title={title}>
      <Image src={channel.logo} alt={channel.label} width={20} height={20} />
    </span>
  )
}

function ChannelRow({ label, channels }: { label: string; channels: ChannelIndicator[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono uppercase text-[color:var(--text-tertiary)] w-20 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2">
        {channels.map((ch) => (
          <ChannelIcon key={ch.id} channel={ch} />
        ))}
      </div>
    </div>
  )
}

export function AgentCard({
  title,
  description,
  avatar,
  channels,
  destinations,
  onClick,
  knowledgeRow,
}: AgentCardProps) {
  return (
    <Card
      className="cursor-pointer transition hover:border-[color:var(--accent-selected)]"
    >
      <div onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}>
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">{avatar}</span>
          <div>
            <Heading as="h3" size="subsection">{title}</Heading>
            <p className="text-sm text-[color:var(--text-secondary)] mt-0.5">{description}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {channels.length > 0 && <ChannelRow label="Channels" channels={channels} />}
          {destinations && destinations.length > 0 && (
            <ChannelRow label="Destinations" channels={destinations} />
          )}
          {knowledgeRow && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-[color:var(--text-tertiary)] w-20 shrink-0">
                CS Knowledge
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <Button
                  variant="link"
                  size="sm"
                  className="truncate"
                  onClick={(e) => {
                    e.stopPropagation()
                    knowledgeRow.onClick(e)
                  }}
                >
                  {knowledgeRow.label}
                </Button>
                {knowledgeRow.meta && (
                  <span className="text-[10px] text-[color:var(--text-tertiary)] shrink-0">
                    {knowledgeRow.meta}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

/** Build channel indicators for the Hissuno Agent */
export function buildSupportChannels(statuses: IntegrationStatuses): ChannelIndicator[] {
  return [
    { id: 'widget', logo: null, label: 'Widget', active: statuses.widget },
    { id: 'slack', logo: '/logos/slack.svg', label: 'Slack', active: statuses.slack },
  ]
}

/** Build source channel indicators for the PM Agent */
export function buildPmSources(statuses: IntegrationStatuses): ChannelIndicator[] {
  return [
    { id: 'widget', logo: null, label: 'Widget', active: statuses.widget },
    { id: 'slack', logo: '/logos/slack.svg', label: 'Slack', active: statuses.slack },
    { id: 'intercom', logo: '/logos/intercom.svg', label: 'Intercom', active: statuses.intercom },
    { id: 'gong', logo: '/logos/gong.svg', label: 'Gong', active: statuses.gong },
    { id: 'gmail', logo: '/logos/gmail.svg', label: 'Gmail', active: false, comingSoon: true },
  ]
}

/** Build destination indicators for the PM Agent */
export function buildPmDestinations(statuses: IntegrationStatuses): ChannelIndicator[] {
  return [
    { id: 'jira', logo: '/logos/jira.svg', label: 'Jira', active: statuses.jira },
    { id: 'linear', logo: '/logos/linear.svg', label: 'Linear', active: false, comingSoon: true },
  ]
}
