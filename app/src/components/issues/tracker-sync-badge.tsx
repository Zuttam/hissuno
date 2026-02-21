'use client'

import type { TrackerIssueSyncStatus, IssueTrackerProvider } from '@/types/issue-tracker'

// ============================================================================
// Provider Icons
// ============================================================================

function JiraIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.53 2c0 4.97 3.86 9 8.47 9H22v1.67C22 17.73 17.73 22 12.67 22H12c-5.52 0-10-4.48-10-10v-.67C2 6.27 6.27 2 11.33 2h.2z"
        fill="currentColor"
        className="text-[color:var(--text-secondary)]"
      />
    </svg>
  )
}

function LinearIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1.22541 61.5228c-.97401-3.8318-.97401-7.7193 0-11.5511L17.655 6.81089C19.0919 1.94756 24.0123-.32744 28.8756 1.10952l46.1612 11.69808c4.8634 1.23691 7.7838 6.1574 6.5469 11.0207L65.1535 67.0893c-1.4369 4.8634-6.3574 7.7838-11.2207 6.547L7.77153 61.9378c-.03241-.0082-.06477-.0167-.09733-.0253z"
        fill="currentColor"
        className="text-[color:var(--text-secondary)]"
        transform="scale(0.9) translate(5, 5)"
      />
    </svg>
  )
}

const PROVIDER_ICONS: Record<IssueTrackerProvider, (props: { size?: number }) => React.ReactNode> = {
  jira: JiraIcon,
  linear: LinearIcon,
}

const PROVIDER_NAMES: Record<IssueTrackerProvider, string> = {
  jira: 'Jira',
  linear: 'Linear',
}

// ============================================================================
// Inline Badge (for issue metadata row)
// ============================================================================

interface TrackerSyncBadgeInlineProps {
  status: TrackerIssueSyncStatus
  isRetrying: boolean
  onRetry: () => void
}

export function TrackerSyncBadgeInline({ status, isRetrying, onRetry }: TrackerSyncBadgeInlineProps) {
  const Icon = PROVIDER_ICONS[status.provider]

  return (
    <span className="inline-flex items-center gap-1">
      <Icon size={12} />
      {status.externalIssueUrl ? (
        <a
          href={status.externalIssueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[color:var(--accent-selected)] hover:underline"
        >
          {status.externalIssueKey}
        </a>
      ) : (
        <span>{status.externalIssueKey || PROVIDER_NAMES[status.provider]}</span>
      )}
      {status.lastSyncStatus === 'failed' && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="text-[color:var(--accent-danger)] hover:underline disabled:opacity-50"
        >
          {isRetrying ? '...' : '(retry)'}
        </button>
      )}
    </span>
  )
}
