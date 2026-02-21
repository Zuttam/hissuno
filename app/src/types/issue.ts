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
 * - open: Not yet reviewed by PM agent
 * - ready: Ready for engineering (spec generated)
 * - in_progress: Engineering work began
 * - closed: Marked irrelevant by user
 * - resolved: Issue merged to codebase
 */
export type IssueStatus = 'open' | 'ready' | 'in_progress' | 'resolved' | 'closed'

/**
 * Effort estimation levels
 */
export type EffortEstimate = 'trivial' | 'small' | 'medium' | 'large' | 'xlarge'

/**
 * Impact analysis for an issue
 */
export interface IssueImpactAnalysis {
  affectedAreas: Array<{
    area: string
    category: string
    relevance: number
  }>
  impactScore: number
  reasoning: string
}

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
  is_archived: boolean
  // Impact analysis
  affected_areas: string[]
  impact_score: number | null
  impact_analysis: IssueImpactAnalysis | null
  // Effort estimation
  effort_estimate: EffortEstimate | null
  effort_reasoning: string | null
  affected_files: string[]
  // Analysis metrics
  reach_score: number | null
  reach_reasoning: string | null
  effort_score: number | null
  confidence_score: number | null
  confidence_reasoning: string | null
  rice_score: number | null
  analysis_computed_at: string | null
  // Timestamps
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
 * Issue with linked feedback (includes contact/company data for customer impact)
 */
export interface IssueWithSessions extends IssueWithProject {
  sessions: {
    id: string
    user_id: string | null
    page_url: string | null
    message_count: number
    created_at: string
    name: string | null
    source: 'widget' | 'slack' | 'intercom' | 'gong' | 'api' | 'manual'
    contact_id: string | null
    contact: {
      id: string
      name: string
      email: string
      company: {
        id: string
        name: string
        arr: number | null
        stage: string
      } | null
    } | null
  }[]
}

/**
 * Computed customer impact summary for an issue
 */
export interface IssueCustomerImpact {
  contactCount: number
  companyCount: number
  totalARR: number
  companies: Array<{
    id: string
    name: string
    arr: number | null
    stage: string
    contactCount: number
  }>
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
 * Widget trigger types - what activates the widget
 */
export type WidgetTrigger = 'bubble' | 'drawer-badge' | 'headless'

/**
 * Widget display types - how the chat UI appears
 */
export type WidgetDisplay = 'popup' | 'sidepanel' | 'dialog'

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
  issue_tracking_enabled: boolean
  pm_dedup_include_closed: boolean
  // Widget settings (new trigger/display model)
  widget_trigger_type: WidgetTrigger
  widget_display_type: WidgetDisplay
  widget_shortcut: string | null
  widget_drawer_badge_label: string
  // Legacy widget settings
  widget_variant: WidgetDisplay
  widget_theme: WidgetTheme
  widget_position: WidgetPosition
  widget_title: string
  widget_initial_message: string
  // Widget security settings (moved from projects table)
  allowed_origins: string[] | null
  widget_token_required: boolean | null
  // Session lifecycle settings
  session_idle_timeout_minutes: number
  session_goodbye_delay_seconds: number
  session_idle_response_timeout_seconds: number
  created_at: string
  updated_at: string
}

/**
 * Input for creating a new issue
 */
export interface CreateIssueInput {
  project_id: string
  session_ids?: string[]
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
  reach_score?: number
  impact_score?: number
  confidence_score?: number
  effort_score?: number
}

/**
 * Metric level for filtering (maps to score ranges: high=4-5, medium=2-3, low=1)
 */
export type MetricLevel = 'high' | 'medium' | 'low'

/**
 * Filters for listing issues
 */
export interface IssueFilters {
  projectId?: string
  type?: IssueType
  priority?: IssuePriority
  status?: IssueStatus
  search?: string
  showArchived?: boolean
  reachLevel?: MetricLevel
  impactLevel?: MetricLevel
  confidenceLevel?: MetricLevel
  effortLevel?: MetricLevel
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
}

/**
 * PM Review result for API response
 */
export interface PMReviewResult {
  action: 'created' | 'upvoted' | 'skipped'
  issueId?: string
  issueTitle?: string
  skipReason?: string
  // Enriched fields from multi-step workflow
  impactScore?: number
  effortEstimate?: EffortEstimate
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

/**
 * Result of issue analysis workflow
 */
export interface IssueAnalysisResult {
  reachScore: number | null
  reachReasoning: string | null
  impactScore: number | null
  impactReasoning: string | null
  confidenceScore: number | null
  confidenceReasoning: string | null
  effortScore: number | null
  effortReasoning: string | null
  riceScore: number | null
  priority: IssuePriority | null
  analysisComputedAt: string
}

/**
 * Issue analysis run record from database
 */
export interface IssueAnalysisRunRecord {
  id: string
  issue_id: string
  project_id: string
  run_id: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  completed_at: string | null
  error_message: string | null
  metadata: Record<string, unknown> | null
}
