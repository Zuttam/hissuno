'use client'

import { Badge } from '@/components/ui'
import type { IssueWithProject, IssueType, IssuePriority, IssueStatus, EffortEstimate } from '@/types/issue'

interface IssuesTableProps {
  issues: IssueWithProject[]
  selectedIssueId: string | null
  onSelectIssue: (issue: IssueWithProject) => void
  onArchive: (issue: IssueWithProject) => void
}

export function IssuesTable({
  issues,
  selectedIssueId,
  onSelectIssue,
  onArchive,
}: IssuesTableProps) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)]">
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-[color:var(--border-subtle)]">
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Title
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Type
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Project
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Upvotes
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Priority
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Impact
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Effort
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Status
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Spec
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Updated
            </th>
            <th className="w-12 px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              isSelected={selectedIssueId === issue.id}
              onSelect={() => onSelectIssue(issue)}
              onArchive={() => onArchive(issue)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface IssueRowProps {
  issue: IssueWithProject
  isSelected: boolean
  onSelect: () => void
  onArchive: () => void
}

function IssueRow({ issue, isSelected, onSelect, onArchive }: IssueRowProps) {
  const truncatedTitle = issue.title.length > 50
    ? `${issue.title.slice(0, 50)}...`
    : issue.title

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-[color:var(--border-subtle)] transition-colors ${
        isSelected
          ? 'bg-[color:var(--accent-primary)]/10'
          : 'hover:bg-[color:var(--surface-hover)]'
      } ${issue.is_archived ? 'opacity-60' : ''}`}
    >
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <span className="text-[color:var(--foreground)]" title={issue.title}>
            {truncatedTitle}
          </span>
          {issue.is_archived && (
            <Badge variant="default">Archived</Badge>
          )}
        </span>
      </td>
      <td className="px-3 py-2">
        <TypeBadge type={issue.type} />
      </td>
      <td className="px-3 py-2">
        <span className="text-[color:var(--foreground)]">
          {issue.project?.name || '-'}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className="font-bold text-[color:var(--foreground)]">
          {issue.upvote_count}
        </span>
      </td>
      <td className="px-3 py-2">
        <PriorityBadge priority={issue.priority} isManual={issue.priority_manual_override} />
      </td>
      <td className="px-3 py-2 text-center">
        <ImpactBadge score={issue.impact_score} />
      </td>
      <td className="px-3 py-2">
        <EffortBadge effort={issue.effort_estimate} />
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={issue.status} />
      </td>
      <td className="px-3 py-2">
        {issue.product_spec ? (
          <Badge variant="success">Ready</Badge>
        ) : (
          <span className="text-[color:var(--text-secondary)]">-</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="text-[color:var(--text-secondary)]">
          {formatRelativeTime(issue.updated_at)}
        </span>
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onArchive()
          }}
          className="rounded-[4px] p-1.5 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-primary)]"
          aria-label={issue.is_archived ? 'Unarchive issue' : 'Archive issue'}
          title={issue.is_archived ? 'Unarchive' : 'Archive'}
        >
          {issue.is_archived ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="5" rx="2" />
              <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
              <path d="M12 13v4" />
              <path d="m9 16 3 3 3-3" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="5" rx="2" />
              <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
              <path d="M10 13h4" />
            </svg>
          )}
        </button>
      </td>
    </tr>
  )
}

function TypeBadge({ type }: { type: IssueType }) {
  const labels: Record<IssueType, string> = {
    bug: 'Bug',
    feature_request: 'Feature',
    change_request: 'Change',
  }

  const variants: Record<IssueType, 'danger' | 'info' | 'warning'> = {
    bug: 'danger',
    feature_request: 'info',
    change_request: 'warning',
  }

  return <Badge variant={variants[type]}>{labels[type]}</Badge>
}

function PriorityBadge({ priority, isManual }: { priority: IssuePriority; isManual: boolean }) {
  const variants: Record<IssuePriority, 'danger' | 'warning' | 'default'> = {
    high: 'danger',
    medium: 'warning',
    low: 'default',
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={variants[priority]}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
      {isManual && (
        <span 
          className="text-[color:var(--text-secondary)]" 
          title="Priority set manually"
        >
          ✎
        </span>
      )}
    </span>
  )
}

function ImpactBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-[color:var(--text-secondary)]">-</span>
  }

  // Color based on impact level
  const getColor = (s: number) => {
    if (s >= 4) return 'text-[color:var(--accent-danger)]'
    if (s >= 3) return 'text-[color:var(--accent-warning)]'
    return 'text-[color:var(--text-secondary)]'
  }

  return (
    <span className={`font-bold ${getColor(score)}`} title={`Impact score: ${score}/5`}>
      {score}/5
    </span>
  )
}

function EffortBadge({ effort }: { effort: EffortEstimate | null }) {
  if (!effort) {
    return <span className="text-[color:var(--text-secondary)]">-</span>
  }

  const labels: Record<EffortEstimate, string> = {
    trivial: 'XS',
    small: 'S',
    medium: 'M',
    large: 'L',
    xlarge: 'XL',
  }

  const descriptions: Record<EffortEstimate, string> = {
    trivial: 'Trivial (<1 hour)',
    small: 'Small (1-4 hours)',
    medium: 'Medium (1-2 days)',
    large: 'Large (3-5 days)',
    xlarge: 'XLarge (1+ week)',
  }

  const variants: Record<EffortEstimate, 'success' | 'default' | 'warning' | 'danger' | 'info'> = {
    trivial: 'success',
    small: 'success',
    medium: 'default',
    large: 'warning',
    xlarge: 'danger',
  }

  return (
    <Badge variant={variants[effort]} title={descriptions[effort]}>
      {labels[effort]}
    </Badge>
  )
}

function StatusBadge({ status }: { status: IssueStatus }) {
  const labels: Record<IssueStatus, string> = {
    open: 'Open',
    ready: 'Ready',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
  }

  const variants: Record<IssueStatus, 'default' | 'info' | 'success' | 'warning'> = {
    open: 'default',
    ready: 'success',
    in_progress: 'info',
    resolved: 'success',
    closed: 'warning',
  }

  return <Badge variant={variants[status]}>{labels[status]}</Badge>
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return 'Just now'
  } else if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}
