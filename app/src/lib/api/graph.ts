import { fetchApi, buildUrl } from './fetch'
import type { GraphData } from '@/components/graph/types'

export async function getGraphData(
  projectId: string,
  opts?: { includeOrphans?: boolean },
): Promise<GraphData | null> {
  return fetchApi<GraphData>(
    buildUrl('/api/graph', {
      projectId,
      ...(opts?.includeOrphans === false ? { includeOrphans: 'false' } : {}),
    }),
    { errorMessage: 'Failed to load graph data.' },
  )
}
