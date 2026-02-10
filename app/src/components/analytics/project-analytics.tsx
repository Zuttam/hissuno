'use client'

import { useProjectAnalytics, useImpactFlowAnalytics } from '@/hooks/use-analytics'
import { PeriodSelector } from './period-selector'
import { StatCard, StatCardGrid } from './stat-card'
import { LineChart, BarChart } from './charts'
import { ImpactFlowGraph } from './impact-flow-graph'
import { Spinner } from '@/components/ui/spinner'
import { VelocityChart } from '@/components/dashboard/velocity-chart'
import type { IssueVelocityData } from '@/types/dashboard'

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

interface ProjectAnalyticsProps {
  projectId: string
  velocityData?: IssueVelocityData | null
}

export function ProjectAnalytics({ projectId, velocityData }: ProjectAnalyticsProps) {
  const { data, isLoading, error, period, setPeriod } = useProjectAnalytics({
    projectId,
  })
  const {
    data: impactFlowData,
    isLoading: impactFlowLoading,
    error: impactFlowError,
  } = useImpactFlowAnalytics({
    period,
    projectId,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner size="md" />
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
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Summary Cards */}
      <StatCardGrid columns={4}>
        <StatCard
          label="Feedback"
          value={data.sessions.total}
          change={data.sessions.change}
          size="sm"
        />
        <StatCard
          label="Active Issues"
          value={data.activeIssues.total}
          change={data.activeIssues.change}
          size="sm"
        />
        <StatCard
          label="Avg Messages"
          value={data.avgMessages.value}
          change={data.avgMessages.change}
          size="sm"
        />
        <StatCard
          label="Top Tag"
          value={data.topTag ? TAG_LABEL_MAP[data.topTag] ?? data.topTag : 'None'}
          trend="neutral"
          size="sm"
        />
      </StatCardGrid>

      {/* Issue Velocity */}
      {velocityData && (
        <ChartCard title="Issue Velocity">
          <VelocityChart velocity={velocityData} />
        </ChartCard>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Feedback Over Time">
          {data.timeSeries.sessions.length > 0 ? (
            <LineChart
              data={data.timeSeries.sessions}
              label="Feedback"
              color="var(--accent-info)"
              height={180}
            />
          ) : (
            <EmptyChartState />
          )}
        </ChartCard>

        <ChartCard title="Feedback by Tag">
          {data.distributions.sessionsByTag.length > 0 ? (
            <BarChart
              data={data.distributions.sessionsByTag}
              labelFormatter={(label) => TAG_LABEL_MAP[label] ?? label}
              height={180}
            />
          ) : (
            <EmptyChartState />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Feedback by Source">
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

        <ChartCard title="Issues by Type">
          {data.distributions.issuesByType.length > 0 ? (
            <BarChart
              data={data.distributions.issuesByType}
              labelFormatter={(label) => TYPE_LABEL_MAP[label] ?? label}
              height={180}
            />
          ) : (
            <EmptyChartState />
          )}
        </ChartCard>
      </div>

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

      {/* Impact Flow Graph */}
      <ChartCard title="Customer Impact Flow">
        <ImpactFlowGraph
          data={impactFlowData}
          isLoading={impactFlowLoading}
          error={impactFlowError}
          projectId={projectId}
        />
      </ChartCard>
    </div>
  )
}

interface ChartCardProps {
  title: string
  children: React.ReactNode
}

export function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3">
      <h4 className="mb-3 font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
        {title}
      </h4>
      {children}
    </div>
  )
}

function EmptyChartState() {
  return (
    <div className="flex h-[150px] items-center justify-center text-xs text-[color:var(--text-secondary)]">
      No data available
    </div>
  )
}
