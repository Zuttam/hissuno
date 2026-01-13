'use client'

import { ChannelRow } from './channel-row'

export function IntercomChannel() {
  return (
    <ChannelRow
      icon="/intercom.svg"
      iconType="svg"
      name="Intercom"
      description="Import customer conversations from Intercom to enhance support insights"
      isExpanded={false}
      comingSoon
      onToggle={() => {}}
    />
  )
}
