import { fetchApi, buildUrl } from './fetch'
import type {
  AnalyticsPeriod,
  OverallAnalytics,
  ProjectAnalytics,
  SessionsStripAnalytics,
  IssuesStripAnalytics,
  CustomerSegmentationAnalytics,
  EntityGraphAnalytics,
  EdgeEntitiesData,
  DrilldownData,
} from '@/lib/db/queries/analytics'
import type { DashboardActionableData } from '@/types/dashboard'

const paths = {
  analytics: '/api/analytics',
  dashboard: '/api/dashboard',
}

export async function getOverallAnalytics(period: AnalyticsPeriod, projectId?: string): Promise<OverallAnalytics | null> {
  const url = buildUrl(paths.analytics, { period, projectId })
  const { data } = await fetchApi<{ data: OverallAnalytics | null }>(url, {
    errorMessage: 'Failed to load analytics.',
  })
  return data ?? null
}

export async function getProjectAnalytics(projectId: string, period: AnalyticsPeriod): Promise<ProjectAnalytics | null> {
  const url = buildUrl(paths.analytics, { type: 'project', projectId, period })
  const { data } = await fetchApi<{ data: ProjectAnalytics | null }>(url, {
    errorMessage: 'Failed to load project analytics.',
  })
  return data ?? null
}

export async function getSessionsStripAnalytics(projectId?: string): Promise<SessionsStripAnalytics | null> {
  const url = buildUrl(paths.analytics, { type: 'sessions-strip', projectId })
  const { data } = await fetchApi<{ data: SessionsStripAnalytics | null }>(url, {
    errorMessage: 'Failed to load session analytics.',
  })
  return data ?? null
}

export async function getIssuesStripAnalytics(projectId?: string): Promise<IssuesStripAnalytics | null> {
  const url = buildUrl(paths.analytics, { type: 'issues-strip', projectId })
  const { data } = await fetchApi<{ data: IssuesStripAnalytics | null }>(url, {
    errorMessage: 'Failed to load issue analytics.',
  })
  return data ?? null
}

export async function getCustomerSegmentationAnalytics(projectId: string, period: AnalyticsPeriod): Promise<CustomerSegmentationAnalytics | null> {
  const url = buildUrl(paths.analytics, { type: 'customer-segmentation', projectId, period })
  const { data } = await fetchApi<{ data: CustomerSegmentationAnalytics | null }>(url, {
    errorMessage: 'Failed to load customer segmentation analytics.',
  })
  return data ?? null
}

export async function getEntityGraphAnalytics(
  projectId: string,
): Promise<EntityGraphAnalytics | null> {
  const url = buildUrl(paths.analytics, { type: 'entity-graph', projectId })
  const { data } = await fetchApi<{ data: EntityGraphAnalytics | null }>(url, {
    errorMessage: 'Failed to load entity graph analytics.',
  })
  return data ?? null
}

export async function getEdgeEntities(
  projectId: string,
  sourceCategory: string,
  targetCategory: string,
  limit: number = 10,
): Promise<EdgeEntitiesData | null> {
  const url = buildUrl(paths.analytics, {
    type: 'entity-graph-edge-entities',
    projectId,
    sourceCategory,
    targetCategory,
    limit,
  })
  const { data } = await fetchApi<{ data: EdgeEntitiesData | null }>(url, {
    errorMessage: 'Failed to load edge entities.',
  })
  return data ?? null
}

export async function getDrilldownData(
  projectId: string,
  category: string,
  level: 'groups' | 'entities',
  groupBy?: string,
  groupValue?: string,
  limit?: number,
): Promise<DrilldownData | null> {
  const url = buildUrl(paths.analytics, {
    type: 'entity-graph-drilldown',
    projectId,
    category,
    level,
    groupBy,
    groupValue,
    limit,
  })
  const { data } = await fetchApi<{ data: DrilldownData | null }>(url, {
    errorMessage: 'Failed to load drilldown data.',
  })
  return data ?? null
}

export async function getChildEntityEdges(
  projectId: string,
  category: string,
  childIds: string[],
): Promise<Record<string, string[]> | null> {
  const url = buildUrl(paths.analytics, {
    type: 'entity-graph-child-edges',
    projectId,
    category,
    childIds: childIds.join(','),
  })
  const { data } = await fetchApi<{ data: Record<string, string[]> | null }>(url, {
    errorMessage: 'Failed to load child entity edges.',
  })
  return data ?? null
}

export async function getDashboardData(projectId: string): Promise<DashboardActionableData> {
  const url = buildUrl(paths.dashboard, { projectId })
  return fetchApi<DashboardActionableData>(url, {
    errorMessage: 'Failed to load dashboard data.',
  })
}
