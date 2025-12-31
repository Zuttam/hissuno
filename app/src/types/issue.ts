/**
 * Issue types
 */
export type IssueType = 'bug' | 'feature_request' | 'change_request'

/**
 * Issue priority levels
 */
export type IssuePriority = 'low' | 'medium' | 'high'

/**
 * Issue status
 */
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

/**
 * Issue record from the database
 */
export interface IssueRecord {
  id: string
  project_id: string
  type: IssueType
  title: string
  description: string
  priority: IssuePriority
  priority_manual_override: boolean
  upvote_count: number
  status: IssueStatus
  product_spec: string | null
  product_spec_generated_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Issue with project details for display
 */
export interface IssueWithProject extends IssueRecord {
  project: {
    id: string
    name: string
  } | null
}

/**
 * Issue with linked sessions
 */
export interface IssueWithSessions extends IssueWithProject {
  sessions: {
    id: string
    user_id: string | null
    page_url: string | null
    message_count: number
    created_at: string
  }[]
}

/**
 * Issue session junction record
 */
export interface IssueSessionRecord {
  issue_id: string
  session_id: string
  created_at: string
}

/**
 * Widget display variants
 */
export type WidgetVariant = 'popup' | 'sidepanel'

/**
 * Widget theme options
 */
export type WidgetTheme = 'light' | 'dark' | 'auto'

/**
 * Widget position options
 */
export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

/**
 * Project settings record
 */
export interface ProjectSettingsRecord {
  project_id: string
  issue_spec_threshold: number
  issue_tracking_enabled: boolean
  spec_guidelines: string | null
  // Widget settings
  widget_variant: WidgetVariant
  widget_theme: WidgetTheme
  widget_position: WidgetPosition
  widget_title: string
  widget_initial_message: string
  created_at: string
  updated_at: string
}

/**
 * Input for creating a new issue
 */
export interface CreateIssueInput {
  project_id: string
  session_id: string
  type: IssueType
  title: string
  description: string
  priority?: IssuePriority
}

/**
 * Input for updating an issue
 */
export interface UpdateIssueInput {
  title?: string
  description?: string
  type?: IssueType
  priority?: IssuePriority
  priority_manual_override?: boolean
  status?: IssueStatus
}

/**
 * Filters for listing issues
 */
export interface IssueFilters {
  projectId?: string
  type?: IssueType
  priority?: IssuePriority
  status?: IssueStatus
  search?: string
  limit?: number
  offset?: number
}

/**
 * Result of session analysis by PM Agent
 */
export interface SessionAnalysisResult {
  isActionable: boolean
  type?: IssueType
  title?: string
  description?: string
  userQuotes?: string[]
  suggestedPriority?: IssuePriority
  confidence: number
  reasoning?: string
  skipReason?: string
}

/**
 * Result of similar issue search
 */
export interface SimilarIssueResult {
  issue: IssueRecord
  similarityScore: number
  matchReason: string
}

/**
 * Result of upvoting an issue
 */
export interface UpvoteResult {
  issueId: string
  newUpvoteCount: number
  newPriority: IssuePriority
  thresholdMet: boolean
  shouldGenerateSpec: boolean
}

/**
 * PM Review result for API response
 */
export interface PMReviewResult {
  action: 'created' | 'upvoted' | 'skipped'
  issueId?: string
  issueTitle?: string
  skipReason?: string
  thresholdMet?: boolean
  specGenerated?: boolean
}

/**
 * PM Review status values
 */
export type PMReviewStatus = 'running' | 'completed' | 'failed'

/**
 * PM Review record from database
 */
export interface PMReviewRecord {
  id: string
  session_id: string
  project_id: string
  run_id: string
  status: PMReviewStatus
  started_at: string
  completed_at: string | null
  error_message: string | null
  result: PMReviewResult | null
  metadata: Record<string, unknown> | null
  created_at: string
}

/**
 * PM Review status response from API
 */
export interface PMReviewStatusResponse {
  isRunning: boolean
  reviewId: string | null
  runId: string | null
  status: PMReviewStatus | null
  startedAt: string | null
  completedAt: string | null
  result: PMReviewResult | null
  error: string | null
}

/**
 * SSE event types for PM review streaming
 */
export type PMReviewSSEEventType =
  | 'connected'
  | 'review-start'
  | 'step-start'
  | 'step-progress'
  | 'step-finish'
  | 'review-finish'
  | 'error'

/**
 * SSE event for PM review streaming
 */
export interface PMReviewSSEEvent {
  type: PMReviewSSEEventType
  stepId?: string
  stepName?: string
  message?: string
  data?: Record<string, unknown>
  result?: PMReviewResult
  timestamp: string
}
