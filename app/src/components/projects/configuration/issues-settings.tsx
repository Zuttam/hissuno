'use client'


interface TrackingToggleProps {
  trackingEnabled: boolean
  onTrackingEnabledChange: (enabled: boolean) => void
}

export function TrackingToggle({
  trackingEnabled,
  onTrackingEnabledChange,
}: TrackingToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="font-mono text-sm font-medium text-[color:var(--foreground)]">
          Automatically Create Issues
        </label>
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          Automatically create and track issues from customer feedback
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={trackingEnabled}
        onClick={() => onTrackingEnabledChange(!trackingEnabled)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:ring-offset-2 ${
          trackingEnabled ? 'bg-[color:var(--accent-primary)]' : 'bg-[color:var(--surface-hover)]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            trackingEnabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export interface IssuesSettings {
  issue_tracking_enabled: boolean
}

