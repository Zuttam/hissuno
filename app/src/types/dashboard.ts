import type { TimeSeriesPoint } from '@/lib/supabase/analytics'
import type { IssueWithProject } from '@/types/issue'
import type { SessionSource } from '@/types/session'

export interface IssuePipelineStats {
  total: number
  open: number
  ready: number
  inProgress: number
  resolved: number
  closed: number
}

export interface IssueVelocityData {
  created: TimeSeriesPoint[]
  resolved: TimeSeriesPoint[]
  cumulativeOpen: number
}

export interface PendingReviewSession {
  id: string
  name: string | null
  user_id: string | null
  user_metadata: Record<string, string> | null
  source: SessionSource
  message_count: number
  created_at: string
}

export interface DashboardActionableData {
  pipeline: IssuePipelineStats
  topIssues: IssueWithProject[]
  pendingReviews: { sessions: PendingReviewSession[]; count: number }
  velocity: IssueVelocityData
}
