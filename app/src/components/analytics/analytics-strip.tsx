'use client'

import { useState } from 'react'
import { useSessionsStripAnalytics, useIssuesStripAnalytics, useAnalytics } from '@/hooks/use-analytics'
import { useCustomerAnalytics } from '@/hooks/use-customer-analytics'
import { Card } from '@/components/ui/card'
import { MiniBar } from './charts/sparkline'
import { LineChart } from './charts/line-chart'
import { BarChart } from './charts/bar-chart'
import { cn } from '@/lib/utils/class'
import { formatARR } from '@/lib/utils/format-currency'

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

const STAGE_LABEL_MAP: Record<string, string> = {
  prospect: 'Prospect',
  onboarding: 'Onboarding',
  active: 'Active',
  churned: 'Churned',
  expansion: 'Expansion',
}

interface AnalyticsStripProps {
  type: 'sessions' | 'issues' | 'customers'
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

  if (type === 'customers') {
    return (
      <CustomersStrip
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
    <Card className={className}>
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
              <span className="font-mono text-xs text-[color:var(--text-secondary)]">feedbacks</span>
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
                Feedback Over Time (30 days)
              </h4>
              <LineChart
                data={fullData.timeSeries.sessions}
                color="var(--accent-primary)"
                height={180}
                label="Feedback"
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
    </Card>
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
    <Card className={className}>
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
    </Card>
  )
}

function CustomersStrip({ projectId, isExpanded, onToggle, className }: StripContentProps) {
  const { data: stripData, isLoading: stripLoading } = useCustomerAnalytics({ projectId })

  if (stripLoading && !stripData) {
    return null
  }

  const { totalCompanies, totalContacts, champions, totalARR, avgARR, byStage } = stripData ?? {
    totalCompanies: 0,
    totalContacts: 0,
    champions: 0,
    totalARR: 0,
    avgARR: 0,
    byStage: [],
  }

  return (
    <Card className={className}>
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
              <span className="font-mono text-sm font-bold text-[color:var(--foreground)]">{totalCompanies}</span>
              <span className="font-mono text-xs text-[color:var(--text-secondary)]">{totalCompanies === 1 ? 'company' : 'companies'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-[color:var(--foreground)]">{totalContacts}</span>
              <span className="font-mono text-xs text-[color:var(--text-secondary)]">{totalContacts === 1 ? 'contact' : 'contacts'}</span>
            </div>
            {champions > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-[color:var(--accent-warning)]">{champions}</span>
                <span className="font-mono text-xs text-[color:var(--text-secondary)]">{champions === 1 ? 'champion' : 'champions'}</span>
              </div>
            )}
            {totalARR > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-[color:var(--accent-success)]">{formatARR(totalARR)}</span>
                <span className="font-mono text-xs text-[color:var(--text-secondary)]">ARR</span>
              </div>
            )}
            {byStage.length > 0 && (
              <div className="hidden sm:block">
                <MiniBar
                  data={byStage.map((s) => ({ label: s.label, value: s.value }))}
                  colorMap={{
                    prospect: 'var(--text-tertiary)',
                    onboarding: 'var(--accent-info)',
                    active: 'var(--accent-success)',
                    churned: 'var(--accent-danger)',
                    expansion: 'var(--accent-warning)',
                  }}
                  height={10}
                  width={60}
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

      {/* Expanded content - charts */}
      {isExpanded && (
        <div className="border-t border-[color:var(--border-subtle)] p-4 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* By Stage */}
            {byStage.length > 0 && (
              <div>
                <h4 className="font-mono text-xs uppercase text-[color:var(--text-secondary)] mb-3">
                  Companies by Stage
                </h4>
                <BarChart
                  data={byStage}
                  labelFormatter={(label) => STAGE_LABEL_MAP[label] ?? label}
                  height={150}
                  colorMap={{
                    prospect: 'var(--text-tertiary)',
                    onboarding: 'var(--accent-info)',
                    active: 'var(--accent-success)',
                    churned: 'var(--accent-danger)',
                    expansion: 'var(--accent-warning)',
                  }}
                />
              </div>
            )}

            {/* ARR Summary */}
            {totalARR > 0 && (
              <div>
                <h4 className="font-mono text-xs uppercase text-[color:var(--text-secondary)] mb-3">
                  Revenue
                </h4>
                <div className="flex items-center gap-6 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
                  <div className="text-center">
                    <p className="font-mono text-2xl font-bold text-[color:var(--foreground)]">
                      {formatARR(totalARR)}
                    </p>
                    <p className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">Total ARR</p>
                  </div>
                  <div className="h-8 w-px bg-[color:var(--border-subtle)]" />
                  <div className="text-center">
                    <p className="font-mono text-2xl font-bold text-[color:var(--foreground)]">
                      {formatARR(avgARR)}
                    </p>
                    <p className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">Avg ARR</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
