import type { TimeSeriesPoint } from '@/lib/db/queries/analytics'

export interface IssueVelocityData {
  created: TimeSeriesPoint[]
  resolved: TimeSeriesPoint[]
  cumulativeOpen: number
}

export interface DashboardActionableData {
  velocity: IssueVelocityData
}
