'use client'

import { useAnalytics } from '@/hooks/use-analytics'
import { AnalyticsHeader } from './analytics-header'
import { StatCard, StatCardGrid } from './stat-card'
import { LineChart, BarChart, PieChart } from './charts'
import { FloatingCard } from '@/components/ui/floating-card'
import { Spinner } from '@/components/ui/spinner'
import { Select } from '@/components/ui/select'
import type { ProjectRecord } from '@/lib/supabase/projects'
import { useState } from 'react'

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

interface AnalyticsDashboardProps {
  projects: ProjectRecord[]
}

export function AnalyticsDashboard({ projects }: AnalyticsDashboardProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined)
  const { data, isLoading, error, period, setPeriod } = useAnalytics({
    projectId: selectedProjectId,
  })

  const projectOptions = [
    { value: '', label: 'All Projects' },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ]

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <EmptyState />
    )
  }

  return (
    <div className="space-y-8">
      <AnalyticsHeader
        title="Analytics"
        period={period}
        onPeriodChange={setPeriod}
        actions={
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
        }
      />

      {/* Summary Cards */}
      <StatCardGrid columns={4}>
        <StatCard
          label="Sessions"
          value={data.sessions.total}
          change={data.sessions.change}
        />
        <StatCard
          label="Issues"
          value={data.issues.total}
          change={data.issues.change}
        />
        <StatCard
          label="Open Issues"
          value={data.issues.open}
          trend="neutral"
        />
        <StatCard
          label="Conversion Rate"
          value={`${data.conversionRate.rate}%`}
          change={data.conversionRate.change}
        />
      </StatCardGrid>

      {/* Time Series Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Sessions Over Time">
          {data.timeSeries.sessions.length > 0 ? (
            <LineChart
              data={data.timeSeries.sessions}
              label="Sessions"
              color="var(--accent-info)"
              height={250}
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
              height={250}
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
              height={200}
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
              height={200}
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
              height={250}
              innerRadius={50}
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
              height={200}
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

      {/* Top Projects */}
      {!selectedProjectId && data.topProjects.length > 0 && (
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
                    <td className="py-3 font-mono text-sm text-[color:var(--foreground)]">
                      {project.name}
                    </td>
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
    </div>
  )
}

interface ChartCardProps {
  title: string
  children: React.ReactNode
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
      <h3 className="mb-4 font-mono text-sm font-semibold uppercase text-[color:var(--foreground)]">
        {title}
      </h3>
      {children}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-10 py-14 text-center">
      <div className="mx-auto max-w-xl space-y-4">
        <h2 className="font-mono text-2xl font-bold uppercase text-[color:var(--foreground)]">
          No data yet
        </h2>
        <p className="text-sm text-[color:var(--text-secondary)]">
          Analytics will appear here once you have sessions and issues in your projects.
          Start by integrating the support widget or creating manual sessions.
        </p>
      </div>
    </div>
  )
}

function EmptyChartState() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-[color:var(--text-secondary)]">
      No data available
    </div>
  )
}
