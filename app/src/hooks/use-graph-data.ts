'use client'

import type { GraphData } from '@/components/graph/types'
import { getGraphData } from '@/lib/api/graph'
import { useFetchData } from './use-fetch-data'

export function useGraphData(projectId: string, opts?: { includeOrphans?: boolean }) {
  const includeOrphans = opts?.includeOrphans
  return useFetchData<GraphData>({
    fetchFn: () => getGraphData(projectId, { includeOrphans }),
    deps: [projectId, includeOrphans],
    skip: !projectId,
    errorPrefix: 'Unexpected error loading graph',
  })
}
