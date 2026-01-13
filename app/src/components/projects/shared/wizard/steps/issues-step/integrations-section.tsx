'use client'

import { ChannelRow } from '../sessions-step/channel-row'

export function IntegrationsSection() {
  return (
    <div className="space-y-2">
      <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--foreground)]">
        Integrations
      </h3>

      <div className="flex flex-col">
        <ChannelRow
          icon="/jira.svg"
          iconType="svg"
          name="Jira"
          description="Sync issues with your Jira projects"
          isExpanded={false}
          comingSoon
          onToggle={() => {}}
        />

        <div className="border-b border-[color:var(--border-subtle)] w-full" />

        <ChannelRow
          icon="/linear.svg"
          iconType="svg"
          name="Linear"
          description="Connect to Linear for seamless issue management"
          isExpanded={false}
          comingSoon
          onToggle={() => {}}
        />
      </div>
    </div>
  )
}
