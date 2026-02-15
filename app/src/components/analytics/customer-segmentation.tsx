'use client'

import Link from 'next/link'
import { StatCard, StatCardGrid } from './stat-card'
import { BarChart } from './charts'
import { ImpactFlowGraph } from './impact-flow-graph'
import { ChartCard } from './project-analytics'
import { Spinner } from '@/components/ui/spinner'
import type { CustomerSegmentationAnalytics, ImpactFlowGraphData } from '@/lib/supabase/analytics'

const STAGE_COLORS: Record<string, string> = {
  prospect: 'var(--accent-info)',
  trial: 'var(--accent-warning)',
  active: 'var(--accent-success)',
  churned: 'var(--accent-danger)',
  expansion: 'var(--accent-selected)',
  Unknown: 'var(--accent-primary)',
}

interface CustomerSegmentationProps {
  data: CustomerSegmentationAnalytics | null
  isLoading: boolean
  error: string | null
  impactFlowData: ImpactFlowGraphData | null
  impactFlowLoading: boolean
  impactFlowError: string | null
  projectId: string
}

export function CustomerSegmentation({
  data,
  isLoading,
  error,
  impactFlowData,
  impactFlowLoading,
  impactFlowError,
  projectId,
}: CustomerSegmentationProps) {
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

  if (!data || (data.summary.companiesWithFeedback === 0 && data.summary.contactsWithFeedback === 0)) {
    return (
      <div className="flex h-[150px] flex-col items-center justify-center rounded-[4px] border border-[color:var(--border-subtle)] text-sm text-[color:var(--text-secondary)]">
        <span>No customer data linked to feedback.</span>
        <span>
          {' '}Link contacts to{' '}
          <Link href={`/projects/${projectId}/sessions`} className="text-[color:var(--accent-selected)] hover:underline">
            feedback data
          </Link>
          {' '}to see customer segmentation.
        </span>
      </div>
    )
  }

  const formatArr = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
  }

  const arrAtRiskData = data.companies.arrAtRiskByStage.map((d) => ({
    label: d.stage,
    value: d.totalArr,
    percentage: data.summary.totalArrAtRisk > 0
      ? Math.round((d.totalArr / data.summary.totalArrAtRisk) * 100)
      : 0,
  }))

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <StatCardGrid columns={4}>
        <StatCard
          label="Companies"
          value={data.summary.companiesWithFeedback}
          size="sm"
        />
        <StatCard
          label="Contacts"
          value={data.summary.contactsWithFeedback}
          size="sm"
        />
        <StatCard
          label="ARR at Risk"
          value={formatArr(data.summary.totalArrAtRisk)}
          size="sm"
        />
        <StatCard
          label="Champion %"
          value={`${data.summary.championFeedbackPercentage}%`}
          size="sm"
        />
      </StatCardGrid>

      {/* Company Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Feedback by Company">
          {data.companies.bySessionCount.length > 0 ? (
            <BarChart
              data={data.companies.bySessionCount}
              horizontal
              height={220}
            />
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        <ChartCard title="Issues by Company">
          {data.companies.byIssueCount.length > 0 ? (
            <BarChart
              data={data.companies.byIssueCount}
              horizontal
              height={220}
            />
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>

      {/* ARR at Risk by Stage */}
      {arrAtRiskData.length > 0 && (
        <ChartCard title="ARR at Risk by Stage">
          <BarChart
            data={arrAtRiskData}
            height={180}
            colorMap={STAGE_COLORS}
            labelFormatter={(label) => label.charAt(0).toUpperCase() + label.slice(1)}
          />
        </ChartCard>
      )}

      {/* Impact Flow */}
      <ChartCard title="Impact Flow">
        <ImpactFlowGraph
          data={impactFlowData}
          isLoading={impactFlowLoading}
          error={impactFlowError}
          projectId={projectId}
          companyFlowData={data.companyImpactFlow}
        />
      </ChartCard>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-[150px] items-center justify-center text-xs text-[color:var(--text-secondary)]">
      No data available
    </div>
  )
}
