'use client'

import { Badge } from '@/components/ui'
import type { IssueWithProject, IssueType, IssuePriority, IssueStatus } from '@/types/issue'

interface IssuesTableProps {
  issues: IssueWithProject[]
  selectedIssueId: string | null
  onSelectIssue: (issue: IssueWithProject) => void
}

export function IssuesTable({
  issues,
  selectedIssueId,
  onSelectIssue,
}: IssuesTableProps) {
  return (
    <div className="overflow-hidden rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)]">
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)]">
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Title
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Project
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Upvotes
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Priority
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Spec
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Updated
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
}

function IssueRow({ issue, isSelected, onSelect }: IssueRowProps) {
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
      }`}
    >
      <td className="px-4 py-3">
        <span className="text-[color:var(--foreground)]" title={issue.title}>
          {truncatedTitle}
        </span>
      </td>
      <td className="px-4 py-3">
        <TypeBadge type={issue.type} />
      </td>
      <td className="px-4 py-3">
        <span className="text-[color:var(--foreground)]">
          {issue.project?.name || '-'}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="font-bold text-[color:var(--foreground)]">
          {issue.upvote_count}
        </span>
      </td>
      <td className="px-4 py-3">
        <PriorityBadge priority={issue.priority} isManual={issue.priority_manual_override} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={issue.status} />
      </td>
      <td className="px-4 py-3">
        {issue.product_spec ? (
          <Badge variant="success">Ready</Badge>
        ) : (
          <span className="text-[color:var(--text-secondary)]">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-[color:var(--text-secondary)]">
          {formatRelativeTime(issue.updated_at)}
        </span>
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

function StatusBadge({ status }: { status: IssueStatus }) {
  const labels: Record<IssueStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
  }

  const variants: Record<IssueStatus, 'default' | 'info' | 'success' | 'warning'> = {
    open: 'default',
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
