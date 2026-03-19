'use client'

import { useEntityGraphAnalytics } from '@/hooks/use-analytics'
import { Spinner } from '@/components/ui/spinner'
import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/section-header'
import { ReactFlowProvider } from '@xyflow/react'
import { EntityGraphOverview } from './entity-graph-overview'

interface EntityGraphProps {
  projectId: string
}

export function EntityGraph({ projectId }: EntityGraphProps) {
  const {
    data,
    isLoading,
    error,
  } = useEntityGraphAnalytics({ projectId })

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

  if (!data || data.overview.totalRelationships === 0) {
    return (
      <div className="flex h-[150px] items-center justify-center rounded-[4px] border border-[color:var(--border-subtle)] text-sm text-[color:var(--text-secondary)]">
        No entity relationships found
      </div>
    )
  }

  return (
    <Card>
      <SectionHeader title="Product Context Graph" titleAs="h3" />
      <div className="h-[500px]">
        <ReactFlowProvider>
          <EntityGraphOverview
            categories={data.overview.categories}
            edges={data.overview.edges}
            recentEntities={data.overview.recentEntities}
            projectId={projectId}
          />
        </ReactFlowProvider>
      </div>
    </Card>
  )
}
