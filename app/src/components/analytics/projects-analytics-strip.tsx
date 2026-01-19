'use client'

import { useState } from 'react'
import { useAnalytics } from '@/hooks/use-analytics'
import { FloatingCard } from '@/components/ui/floating-card'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { PeriodSelector } from './period-selector'
import { StatCard, StatCardGrid } from './stat-card'
import { MiniBar } from './charts/sparkline'
import { LineChart } from './charts/line-chart'
import { BarChart } from './charts/bar-chart'
import { PieChart } from './charts/pie-chart'
import { cn } from '@/lib/utils/class'
import type { ProjectRecord } from '@/lib/supabase/projects'

const TAG_LABEL_MAP: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Feature Request',
  change_request: 'Change Request',
  general_feedback: 'General Feedback',
  wins: 'Wins',
  losses: 'Losses',
}

const TYPE_LABEL_MAP: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Feature Request',
  change_request: 'Change Request',
}

const PRIORITY_LABEL_MAP: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

const SOURCE_LABEL_MAP: Record<string, string> = {
  widget: 'Widget',
  slack: 'Slack',
  intercom: 'Intercom',
  gong: 'Gong',
  api: 'API',
  manual: 'Manual',
}

interface ProjectsAnalyticsStripProps {
  projectId?: string
  projects?: ProjectRecord[]
  className?: string
}

export function ProjectsAnalyticsStrip({ projectId, projects, className }: ProjectsAnalyticsStripProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId)

  // When projectId is provided (project detail page), use it directly
  // When no projectId (projects list page), allow filtering via dropdown
  const effectiveProjectId = projectId ?? selectedProjectId

  const { data, isLoading, error, period, setPeriod } = useAnalytics({
    projectId: effectiveProjectId,
  })

  const projectOptions = projects
    ? [{ value: '', label: 'All Projects' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]
    : []

  // Summary data for minimized view
  const totalProjects = projects?.length ?? 0
  const totalSessions = data?.sessions.total ?? 0
  const totalIssues = data?.issues.total ?? 0
  const conversionRate = data?.conversionRate.rate ?? 0
  const sessionsBySource = data?.distributions.sessionsBySource ?? []

  return (
    <FloatingCard floating="gentle" variant="default" className={cn('py-2', className)}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-2 py-1 text-left"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 flex-1 min-w-0">
          <span className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">Analytics</span>
          {/* Collapsed summary - key metrics in one line */}
          {isLoading && !data ? (
            <Spinner size="sm" />
          ) : (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Show project count only when viewing all projects */}
              {!projectId && totalProjects > 0 && (
                <div className="flex items-center gap-1">
                  <span className="font-mono text-sm font-bold text-[color:var(--foreground)]">{totalProjects}</span>
                  <span className="font-mono text-xs text-[color:var(--text-secondary)]">projects</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="font-mono text-sm font-bold text-[color:var(--foreground)]">{totalSessions}</span>
                <span className="font-mono text-xs text-[color:var(--text-secondary)]">sessions</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-mono text-sm font-bold text-[color:var(--foreground)]">{totalIssues}</span>
                <span className="font-mono text-xs text-[color:var(--text-secondary)]">issues</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-[color:var(--accent-info)]">{conversionRate}%</span>
                <span className="font-mono text-xs text-[color:var(--text-secondary)]">conversion</span>
              </div>
              {sessionsBySource.length > 0 && (
                <div className="hidden sm:block">
                  <MiniBar
                    data={sessionsBySource.map((s) => ({ label: s.label, value: s.value }))}
                    colorMap={{
                      widget: 'var(--accent-info)',
                      slack: 'var(--accent-warning)',
                      api: 'var(--accent-success)',
                      manual: 'var(--text-tertiary)',
                      unknown: 'var(--text-secondary)',
                    }}
                    height={10}
                    width={50}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <svg
          className={cn(
            'h-3 w-3 flex-shrink-0 text-[color:var(--text-secondary)] transition-transform',
            isExpanded && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content - full analytics */}
      {isExpanded && (
        <div className="border-t border-[color:var(--border-subtle)] p-4 space-y-6">
          {/* Controls: Period selector + Project filter (only when no projectId) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <PeriodSelector value={period} onChange={setPeriod} />
            {!projectId && projectOptions.length > 0 && (
              <Select
                value={selectedProjectId ?? ''}
                onChange={(e) => setSelectedProjectId(e.target.value || undefined)}
                className="min-w-[180px]"
              >
                {projectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {isLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : error ? (
            <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
              {error}
            </div>
          ) : !data ? (
            <EmptyState />
          ) : (
            <>
              {/* Summary Cards */}
              <StatCardGrid columns={4}>
                <StatCard label="Sessions" value={data.sessions.total} change={data.sessions.change} />
                <StatCard label="Issues" value={data.issues.total} change={data.issues.change} />
                <StatCard label="Open Issues" value={data.issues.open} trend="neutral" />
                <StatCard label="Conversion Rate" value={`${data.conversionRate.rate}%`} change={data.conversionRate.change} />
              </StatCardGrid>

              {/* Time Series Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard title="Sessions Over Time">
                  {data.timeSeries.sessions.length > 0 ? (
                    <LineChart
                      data={data.timeSeries.sessions}
                      label="Sessions"
                      color="var(--accent-info)"
                      height={200}
                    />
                  ) : (
                    <EmptyChartState />
                  )}
                </ChartCard>

                <ChartCard title="Issues Over Time">
                  {data.timeSeries.issues.length > 0 ? (
                    <LineChart
                      data={data.timeSeries.issues}
                      label="Issues"
                      color="var(--accent-warning)"
                      height={200}
                    />
                  ) : (
                    <EmptyChartState />
                  )}
                </ChartCard>
              </div>

              {/* Distribution Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard title="Sessions by Source">
                  {data.distributions.sessionsBySource.length > 0 ? (
                    <BarChart
                      data={data.distributions.sessionsBySource}
                      labelFormatter={(label) => SOURCE_LABEL_MAP[label] ?? label}
                      height={180}
                    />
                  ) : (
                    <EmptyChartState />
                  )}
                </ChartCard>

                <ChartCard title="Sessions by Tag">
                  {data.distributions.sessionsByTag.length > 0 ? (
                    <BarChart
                      data={data.distributions.sessionsByTag}
                      labelFormatter={(label) => TAG_LABEL_MAP[label] ?? label}
                      horizontal
                      height={180}
                    />
                  ) : (
                    <EmptyChartState />
                  )}
                </ChartCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard title="Issues by Type">
                  {data.distributions.issuesByType.length > 0 ? (
                    <PieChart
                      data={data.distributions.issuesByType}
                      labelFormatter={(label) => TYPE_LABEL_MAP[label] ?? label}
                      height={200}
                      innerRadius={40}
                    />
                  ) : (
                    <EmptyChartState />
                  )}
                </ChartCard>

                <ChartCard title="Issues by Priority">
                  {data.distributions.issuesByPriority.length > 0 ? (
                    <BarChart
                      data={data.distributions.issuesByPriority}
                      labelFormatter={(label) => PRIORITY_LABEL_MAP[label] ?? label}
                      height={180}
                      colorMap={{
                        low: 'var(--accent-success)',
                        medium: 'var(--accent-warning)',
                        high: 'var(--accent-danger)',
                      }}
                    />
                  ) : (
                    <EmptyChartState />
                  )}
                </ChartCard>
              </div>

              {/* Top Projects table - only when viewing all projects and data exists */}
              {!projectId && !effectiveProjectId && data.topProjects && data.topProjects.length > 0 && (
                <ChartCard title="Top Projects">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[color:var(--border-subtle)]">
                          <th className="py-2 text-left font-mono text-xs uppercase text-[color:var(--text-secondary)]">
                            Project
                          </th>
                          <th className="py-2 text-right font-mono text-xs uppercase text-[color:var(--text-secondary)]">
                            Sessions
                          </th>
                          <th className="py-2 text-right font-mono text-xs uppercase text-[color:var(--text-secondary)]">
                            Issues
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topProjects.map((project) => (
                          <tr key={project.id} className="border-b border-[color:var(--border-subtle)]">
                            <td className="py-3 font-mono text-sm text-[color:var(--foreground)]">{project.name}</td>
                            <td className="py-3 text-right font-mono text-sm text-[color:var(--foreground)]">
                              {project.sessionCount.toLocaleString()}
                            </td>
                            <td className="py-3 text-right font-mono text-sm text-[color:var(--foreground)]">
                              {project.issueCount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              )}
            </>
          )}
        </div>
      )}
    </FloatingCard>
  )
}

interface ChartCardProps {
  title: string
  children: React.ReactNode
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
      <h3 className="mb-4 font-mono text-sm font-semibold uppercase text-[color:var(--foreground)]">{title}</h3>
      {children}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-10 py-14 text-center">
      <div className="mx-auto max-w-xl space-y-4">
        <h2 className="font-mono text-2xl font-bold uppercase text-[color:var(--foreground)]">No data yet</h2>
        <p className="text-sm text-[color:var(--text-secondary)]">
          Analytics will appear here once you have sessions and issues in your projects. Start by integrating the
          support widget or creating manual sessions.
        </p>
      </div>
    </div>
  )
}

function EmptyChartState() {
  return (
    <div className="flex h-[150px] items-center justify-center text-sm text-[color:var(--text-secondary)]">
      No data available
    </div>
  )
}
