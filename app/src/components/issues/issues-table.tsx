'use client'

import { useRef, useEffect, useMemo } from 'react'
import { Bug, Lightbulb, RefreshCcw, type LucideIcon } from 'lucide-react'
import { Badge, Checkbox } from '@/components/ui'
import type { IssueWithProject, IssueType, IssuePriority, IssueStatus, EffortEstimate } from '@/types/issue'
import type { ProductScopeRecord } from '@/types/product-scope'
import { calculateRICEScore } from '@/lib/issues/rice'

interface IssuesTableProps {
  issues: IssueWithProject[]
  selectedIssueId: string | null
  onSelectIssue: (issue: IssueWithProject) => void
  onArchive: (issue: IssueWithProject) => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onToggleAll?: () => void
  isAllSelected?: boolean
  isIndeterminate?: boolean
  productScopes?: ProductScopeRecord[]
}

function IssueHeaderCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Checkbox ref={ref} checked={checked} onChange={onChange} />
    </div>
  )
}

export function IssuesTable({
  issues,
  selectedIssueId,
  onSelectIssue,
  onArchive,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  isAllSelected = false,
  isIndeterminate = false,
  productScopes = [],
}: IssuesTableProps) {
  const scopeMap = useMemo(() => {
    const map = new Map<string, ProductScopeRecord>()
    for (const scope of productScopes) {
      map.set(scope.id, scope)
    }
    return map
  }, [productScopes])
  const hasSelection = Boolean(selectedIds && onToggleSelect && onToggleAll)

  return (
    <div className="overflow-hidden overflow-x-auto rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)]">
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-[color:var(--border-subtle)]">
            {hasSelection && (
              <th className="w-10 px-3 py-2">
                <IssueHeaderCheckbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={onToggleAll!}
                />
              </th>
            )}
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Title
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Area
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Type
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Sessions
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Reach
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Impact
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Confidence
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Effort
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              RICE
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Priority
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Status
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Brief
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
              isChecked={selectedIds?.has(issue.id) ?? false}
              onToggleCheck={onToggleSelect ? () => onToggleSelect(issue.id) : undefined}
              scopeMap={scopeMap}
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
  isChecked: boolean
  onToggleCheck?: () => void
  scopeMap: Map<string, ProductScopeRecord>
}

function IssueRow({ issue, isSelected, onSelect, onArchive, isChecked, onToggleCheck, scopeMap }: IssueRowProps) {
  const scope = issue.product_scope_id
    ? scopeMap.get(issue.product_scope_id)
    : [...scopeMap.values()].find((a) => a.is_default)
  const truncatedTitle = issue.name.length > 50
    ? `${issue.name.slice(0, 50)}...`
    : issue.name

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-[color:var(--border-subtle)] transition-colors ${
        isSelected
          ? 'bg-[color:var(--accent-primary)]/10'
          : 'hover:bg-[color:var(--surface-hover)]'
      } ${issue.is_archived ? 'opacity-60' : ''}`}
    >
      {onToggleCheck && (
        <td
          className="w-10 px-3 py-2"
          onClick={(e) => {
            e.stopPropagation()
            onToggleCheck()
          }}
        >
          <Checkbox checked={isChecked} onChange={onToggleCheck} />
        </td>
      )}
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <span className="text-[color:var(--foreground)]" title={issue.name}>
            {truncatedTitle}
          </span>
          {issue.is_archived && (
            <Badge variant="default">Archived</Badge>
          )}
        </span>
      </td>
      <td className="px-3 py-2">
        {scope ? (
          <Badge variant={scope.color}>{scope.name}</Badge>
        ) : (
          <span className="text-[color:var(--text-tertiary)]">-</span>
        )}
      </td>
      <td className="px-3 py-2">
        <TypeBadge type={issue.type} />
      </td>
      <td className="px-3 py-2 text-center">
        <span className="font-bold text-[color:var(--foreground)]">
          {issue.session_count}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <ReachBadge score={issue.reach_score} reasoning={issue.reach_reasoning} />
      </td>
      <td className="px-3 py-2 text-center">
        <ImpactBadge score={issue.impact_score} reasoning={issue.impact_analysis?.reasoning} />
      </td>
      <td className="px-3 py-2 text-center">
        <ConfidenceBadge score={issue.confidence_score} reasoning={issue.confidence_reasoning} />
      </td>
      <td className="px-3 py-2 text-center">
        <EffortBadge effort={issue.effort_estimate} effortScore={issue.effort_score} />
      </td>
      <td className="px-3 py-2 text-center">
        <RICEBadge score={calculateRICEScore(issue.reach_score, issue.impact_score, issue.confidence_score, issue.effort_score)} />
      </td>
      <td className="px-3 py-2">
        <PriorityBadge priority={issue.priority} isManual={issue.priority_manual_override} />
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={issue.status} />
      </td>
      <td className="px-3 py-2">
        {issue.brief ? (
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

const TYPE_ICONS: Record<IssueType, LucideIcon> = {
  bug: Bug,
  feature_request: Lightbulb,
  change_request: RefreshCcw,
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

  const Icon = TYPE_ICONS[type]

  return <Badge variant={variants[type]}><Icon size={10} className="mr-1" />{labels[type]}</Badge>
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

function ReachBadge({ score, reasoning }: { score: number | null; reasoning?: string | null }) {
  if (score === null) {
    return <span className="text-[color:var(--text-secondary)]">-</span>
  }

  const getColor = (s: number) => {
    if (s >= 4) return 'text-[color:var(--accent-danger)]'
    if (s >= 3) return 'text-[color:var(--accent-warning)]'
    return 'text-[color:var(--text-secondary)]'
  }

  return (
    <span className={`font-bold ${getColor(score)}`} title={reasoning ?? `Reach score: ${score}/5`}>
      {score}/5
    </span>
  )
}

function ConfidenceBadge({ score, reasoning }: { score: number | null; reasoning?: string | null }) {
  if (score === null) {
    return <span className="text-[color:var(--text-secondary)]">-</span>
  }

  const getColor = (s: number) => {
    if (s >= 4) return 'text-[color:var(--accent-success)]'
    if (s >= 3) return 'text-[color:var(--accent-warning)]'
    return 'text-[color:var(--text-secondary)]'
  }

  return (
    <span className={`font-bold ${getColor(score)}`} title={reasoning ?? `Confidence score: ${score}/5`}>
      {score}/5
    </span>
  )
}

function RICEBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-[color:var(--text-secondary)]">-</span>
  }

  const numScore = Number(score)
  const getColor = (s: number) => {
    if (s >= 20) return 'text-[color:var(--accent-danger)]'
    if (s >= 5) return 'text-[color:var(--accent-warning)]'
    return 'text-[color:var(--text-secondary)]'
  }

  return (
    <span className={`font-bold ${getColor(numScore)}`} title={`RICE score: ${numScore.toFixed(1)}`}>
      {numScore.toFixed(1)}
    </span>
  )
}

function ImpactBadge({ score, reasoning }: { score: number | null; reasoning?: string | null }) {
  if (score === null) {
    return <span className="text-[color:var(--text-secondary)]">-</span>
  }

  const getColor = (s: number) => {
    if (s >= 4) return 'text-[color:var(--accent-danger)]'
    if (s >= 3) return 'text-[color:var(--accent-warning)]'
    return 'text-[color:var(--text-secondary)]'
  }

  return (
    <span className={`font-bold ${getColor(score)}`} title={reasoning ?? `Impact score: ${score}/5`}>
      {score}/5
    </span>
  )
}

function EffortBadge({ effort, effortScore }: { effort: EffortEstimate | null; effortScore?: number | null }) {
  if (!effort && effortScore == null) {
    return <span className="text-[color:var(--text-secondary)]">-</span>
  }

  if (effortScore != null) {
    const getColor = (s: number) => {
      if (s >= 4) return 'text-[color:var(--accent-danger)]'
      if (s >= 3) return 'text-[color:var(--accent-warning)]'
      return 'text-[color:var(--text-secondary)]'
    }

    const effortLabel = effort ? `${effort} (${effortScore}/5)` : `Effort score: ${effortScore}/5`
    return (
      <span className={`font-bold ${getColor(effortScore)}`} title={effortLabel}>
        {effortScore}/5
      </span>
    )
  }

  // Fall back to enum badge
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
    <Badge variant={variants[effort!]} title={descriptions[effort!]}>
      {labels[effort!]}
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
