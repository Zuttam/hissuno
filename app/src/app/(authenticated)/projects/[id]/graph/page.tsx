'use client'

import { useState } from 'react'
import { useProject } from '@/components/providers/project-provider'
import { useGraphData } from '@/hooks/use-graph-data'
import { PageHeader, Spinner } from '@/components/ui'
import { CanvasGraph } from '@/components/graph/canvas-graph'

export default function GraphPage() {
  const { project, projectId, isLoading } = useProject()
  const [includeOrphans, setIncludeOrphans] = useState(true)
  const { data, isLoading: graphLoading, error, refresh } = useGraphData(projectId ?? '', { includeOrphans })

  if (isLoading || !project || !projectId || graphLoading) {
    return (
      <>
        <PageHeader title="Graph" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Graph" />
        <div className="m-4 rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
          {error}
        </div>
      </>
    )
  }

  if (!data || (data.nodes.length === 0 && data.edges.length === 0)) {
    return (
      <>
        <PageHeader title="Graph" />
        <div className="flex flex-1 items-center justify-center text-sm text-[color:var(--text-secondary)]">
          No entity relationships found
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Graph" />
      <div className="flex-1 min-h-0">
        <CanvasGraph data={data} projectId={projectId} onRefresh={refresh} includeOrphans={includeOrphans} onToggleOrphans={setIncludeOrphans} />
      </div>
    </>
  )
}
