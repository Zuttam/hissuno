'use client'

import { useState } from 'react'
import { useSessionsStripAnalytics, useIssuesStripAnalytics, useAnalytics } from '@/hooks/use-analytics'
import { FloatingCard } from '@/components/ui/floating-card'
import { MiniBar } from './charts/sparkline'
import { LineChart } from './charts/line-chart'
import { BarChart } from './charts/bar-chart'
import { cn } from '@/lib/utils/class'

const STATUS_LABEL_MAP: Record<string, string> = {
  open: 'Open',
  ready: 'Ready',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const TYPE_LABEL_MAP: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Feature',
  change_request: 'Change',
}

const TAG_LABEL_MAP: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Feature Request',
  change_request: 'Change Request',
  general_feedback: 'Feedback',
  wins: 'Win',
  losses: 'Loss',
}

const SOURCE_LABEL_MAP: Record<string, string> = {
  widget: 'Widget',
  slack: 'Slack',
  api: 'API',
  unknown: 'Unknown',
}

const PRIORITY_LABEL_MAP: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

interface AnalyticsStripProps {
  type: 'sessions' | 'issues'
  projectId?: string
  className?: string
}

export function AnalyticsStrip({ type, projectId, className = '' }: AnalyticsStripProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const baseAnalyticsStripClasses = cn('py-2', className)

  if (type === 'sessions') {
    return (
      <SessionsStrip
        projectId={projectId}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        className={baseAnalyticsStripClasses}
      />
    )
  }

  return (
    <IssuesStrip
      projectId={projectId}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      className={baseAnalyticsStripClasses}
    />
  )
}

interface StripContentProps {
  projectId?: string
  isExpanded: boolean
  onToggle: () => void
  className?: string
}

function SessionsStrip({ projectId, isExpanded, onToggle, className }: StripContentProps) {
  const { data: stripData, isLoading: stripLoading } = useSessionsStripAnalytics({ projectId })
  const { data: fullData, isLoading: fullLoading } = useAnalytics({ projectId, period: '30d' })

  const isLoading = stripLoading || (isExpanded && fullLoading)

  if (isLoading && !stripData) {
    return null
  }

  const { total, active, closed, topTags, avgMessages, bySource } = stripData ?? {
    total: 0,
    active: 0,
    closed: 0,
    topTags: [],
    avgMessages: 0,
    bySource: [],
  }

  return (
    <FloatingCard floating="gentle" variant="default" className={className}>
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-2 py-1 text-left"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 flex-1 min-w-0">
          <span className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">
            Analytics
          </span>
          {/* Collapsed summary - key metrics in one line */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1">
              <span className="font-mono text-sm font-bold text-[color:var(--foreground)]">{total}</span>
              <span className="font-mono text-xs text-[color:var(--text-secondary)]">sessions</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-[color:var(--accent-success)]">{active}</span>
              <span className="font-mono text-xs text-[color:var(--text-secondary)]">active</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-[color:var(--text-secondary)]">{closed}</span>
              <span className="font-mono text-xs text-[color:var(--text-secondary)]">closed</span>
            </div>
            {avgMessages > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-[color:var(--foreground)]">{avgMessages}</span>
                <span className="font-mono text-xs text-[color:var(--text-secondary)]">avg msgs</span>
              </div>
            )}
            {bySource.length > 0 && (
              <div className="hidden sm:block">
                <MiniBar
                  data={bySource.map((s) => ({ label: s.label, value: s.value }))}
                  colorMap={{
                    widget: 'var(--accent-info)',
                    slack: 'var(--accent-warning)',
                    api: 'var(--accent-success)',
                    unknown: 'var(--text-secondary)',
                  }}
                  height={10}
                  width={50}
                />
              </div>
            )}
          </div>
        </div>
        <svg
          className={`h-3 w-3 flex-shrink-0 text-[color:var(--text-secondary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content - full charts */}
      {isExpanded && (
        <div className="border-t border-[color:var(--border-subtle)] p-4 space-y-6">
          {/* Time series chart */}
          {fullData?.timeSeries?.sessions && fullData.timeSeries.sessions.length > 0 && (
            <div>
              <h4 className="font-mono text-xs uppercase text-[color:var(--text-secondary)] mb-3">
                Sessions Over Time (30 days)
              </h4>
              <LineChart
                data={fullData.timeSeries.sessions}
                color="var(--accent-primary)"
                height={180}
                label="Sessions"
              />
            </div>
          )}

          {/* Distribution charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* By Source */}
            {bySource.length > 0 && (
              <div>
                <h4 className="font-mono text-xs uppercase text-[color:var(--text-secondary)] mb-3">
                  By Source
                </h4>
                <BarChart
                  data={bySource}
                  labelFormatter={(label) => SOURCE_LABEL_MAP[label] ?? label}
                  height={150}
                  colorMap={{
                    widget: 'var(--accent-info)',
                    slack: 'var(--accent-warning)',
                    api: 'var(--accent-success)',
                    unknown: 'var(--text-secondary)',
                  }}
                />
              </div>
            )}

            {/* By Tag */}
            {topTags.length > 0 && (
              <div>
                <h4 className="font-mono text-xs uppercase text-[color:var(--text-secondary)] mb-3">
                  Top Tags
                </h4>
                <BarChart
                  data={topTags.slice(0, 5)}
                  labelFormatter={(label) => TAG_LABEL_MAP[label] ?? label}
                  height={150}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </FloatingCard>
  )
}

function IssuesStrip({ projectId, isExpanded, onToggle, className }: StripContentProps) {
  const { data: stripData, isLoading: stripLoading } = useIssuesStripAnalytics({ projectId })
  const { data: fullData, isLoading: fullLoading } = useAnalytics({ projectId, period: '30d' })

  const isLoading = stripLoading || (isExpanded && fullLoading)

  if (isLoading && !stripData) {
    return null
  }

  const { total, byStatus, topTypes, byPriority, conversionRate } = stripData ?? {
    total: 0,
    byStatus: [],
    topTypes: [],
    byPriority: [],
    conversionRate: 0,
  }

  const openCount = byStatus.find((s) => s.label === 'open')?.value ?? 0

  return (
    <FloatingCard floating="gentle" variant="default" className={className}>
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-2 py-1 text-left"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 flex-1 min-w-0">
          <span className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">
            Analytics
          </span>
          {/* Collapsed summary - key metrics in one line */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1">
              <span className="font-mono text-sm font-bold text-[color:var(--foreground)]">{total}</span>
              <span className="font-mono text-xs text-[color:var(--text-secondary)]">issues</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-[color:var(--accent-warning)]">{openCount}</span>
              <span className="font-mono text-xs text-[color:var(--text-secondary)]">open</span>
            </div>
            {byStatus.length > 0 && (
              <div className="hidden sm:block">
                <MiniBar
                  data={byStatus.map((s) => ({ label: s.label, value: s.value }))}
                  colorMap={{
                    open: 'var(--accent-warning)',
                    ready: 'var(--accent-success)',
                    in_progress: 'var(--accent-info)',
                    resolved: 'var(--accent-success)',
                    closed: 'var(--text-secondary)',
                  }}
                  height={10}
                  width={60}
                />
              </div>
            )}
            {conversionRate > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-[color:var(--accent-info)]">{conversionRate}%</span>
                <span className="font-mono text-xs text-[color:var(--text-secondary)]">conversion</span>
              </div>
            )}
          </div>
        </div>
        <svg
          className={`h-3 w-3 flex-shrink-0 text-[color:var(--text-secondary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content - full charts */}
      {isExpanded && (
        <div className="border-t border-[color:var(--border-subtle)] p-4 space-y-6">
          {/* Time series chart */}
          {fullData?.timeSeries?.issues && fullData.timeSeries.issues.length > 0 && (
            <div>
              <h4 className="font-mono text-xs uppercase text-[color:var(--text-secondary)] mb-3">
                Issues Over Time (30 days)
              </h4>
              <LineChart
                data={fullData.timeSeries.issues}
                color="var(--accent-danger)"
                height={180}
                label="Issues"
              />
            </div>
          )}

          {/* Distribution charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* By Status */}
            {byStatus.length > 0 && (
              <div>
                <h4 className="font-mono text-xs uppercase text-[color:var(--text-secondary)] mb-3">
                  By Status
                </h4>
                <BarChart
                  data={byStatus}
                  labelFormatter={(label) => STATUS_LABEL_MAP[label] ?? label}
                  height={150}
                  colorMap={{
                    open: 'var(--accent-warning)',
                    ready: 'var(--accent-success)',
                    in_progress: 'var(--accent-info)',
                    resolved: 'var(--accent-success)',
                    closed: 'var(--text-secondary)',
                  }}
                />
              </div>
            )}

            {/* By Type */}
            {topTypes.length > 0 && (
              <div>
                <h4 className="font-mono text-xs uppercase text-[color:var(--text-secondary)] mb-3">
                  By Type
                </h4>
                <BarChart
                  data={topTypes}
                  labelFormatter={(label) => TYPE_LABEL_MAP[label] ?? label}
                  height={150}
                />
              </div>
            )}

            {/* By Priority */}
            {byPriority.length > 0 && (
              <div>
                <h4 className="font-mono text-xs uppercase text-[color:var(--text-secondary)] mb-3">
                  By Priority
                </h4>
                <BarChart
                  data={byPriority}
                  labelFormatter={(label) => PRIORITY_LABEL_MAP[label] ?? label}
                  height={150}
                  colorMap={{
                    high: 'var(--accent-danger)',
                    medium: 'var(--accent-warning)',
                    low: 'var(--accent-success)',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </FloatingCard>
  )
}
