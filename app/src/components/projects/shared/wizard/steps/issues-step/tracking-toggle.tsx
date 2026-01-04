'use client'

import { Checkbox } from '@/components/ui'

interface TrackingToggleProps {
  trackingEnabled: boolean
  onTrackingEnabledChange: (checked: boolean) => void
}

export function TrackingToggle({
  trackingEnabled,
  onTrackingEnabledChange,
}: TrackingToggleProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--foreground)]">
        Issue Tracking
      </h3>

      <Checkbox
        checked={trackingEnabled}
        onChange={onTrackingEnabledChange}
        label="Enable Issue Tracking"
        description="Automatically analyze sessions and create issues for bugs, feature requests, and change requests."
      />
    </div>
  )
}
