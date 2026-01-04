'use client'

import { ChannelRow } from './channel-row'

export function GongChannel() {
  return (
    <ChannelRow
      icon="/gong.svg"
      iconType="svg"
      name="Gong"
      description="Sync customer call recordings and transcripts from Gong for AI analysis"
      isExpanded={false}
      comingSoon
      onToggle={() => {}}
    />
  )
}
