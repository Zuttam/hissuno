/**
 * Analytics time periods
 */
export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all'

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  date: string
  count: number
}

// Alias for component compatibility
export type TimeSeriesDataPoint = TimeSeriesPoint

/**
 * Distribution data point
 */
export interface DistributionDataPoint {
  label: string
  value: number
  percentage: number
}

// Alias for backward compatibility
export type DistributionPoint = DistributionDataPoint

/**
 * Overall analytics data - matches dashboard expectations
 */
export interface OverallAnalytics {
  sessions: {
    total: number
    change?: number
  }
  issues: {
    total: number
    change?: number
    open: number
  }
  conversionRate: {
    rate: number
    change?: number
  }
  timeSeries: {
    sessions: TimeSeriesPoint[]
    issues: TimeSeriesPoint[]
  }
  distributions: {
    sessionsBySource: DistributionPoint[]
    sessionsByTag: DistributionPoint[]
    issuesByType: DistributionPoint[]
    issuesByPriority: DistributionPoint[]
  }
  topProjects: Array<{ id: string; name: string; sessionCount: number; issueCount: number }>
}

/**
 * Project analytics data
 */
export interface ProjectAnalytics {
  sessions: {
    total: number
    change?: number
  }
  activeIssues: {
    total: number
    change?: number
  }
  avgMessages: {
    value: number
    change?: number
  }
  topTag: string | null
  timeSeries: {
    sessions: TimeSeriesPoint[]
  }
  distributions: {
    sessionsByTag: DistributionPoint[]
    sessionsBySource: DistributionPoint[]
    issuesByType: DistributionPoint[]
    issuesByPriority: DistributionPoint[]
  }
}

/**
 * Customer segmentation data point (extends distribution with entity ID and ARR)
 */
export interface CustomerSegmentationDataPoint extends DistributionDataPoint {
  entityId: string
  arr?: number | null
}

/**
 * Company data for the company impact flow Sankey
 */
export interface FlowGraphCompany {
  id: string
  name: string
  sessionCount: number
  issueCount: number
  arr: number | null
  stage: string
}

/**
 * Flow graph node categories
 */
export type FlowNodeCategory = 'source' | 'participant' | 'feedback' | 'issue'

/**
 * Node in the impact flow graph
 */
export interface FlowGraphNode {
  id: string
  name: string
  category: FlowNodeCategory
  color?: string
  expandable?: boolean
}

/**
 * Link between nodes in the flow graph
 */
export interface FlowGraphLink {
  source: number
  target: number
  value: number
}

/**
 * User data for expandable users node
 */
export interface FlowGraphUser {
  id: string
  displayName: string
  sessionCount: number
  email?: string
}

/**
 * Session summary for tooltip display
 */
export interface FlowGraphSession {
  id: string
  name: string | null
  userId: string | null
  source: string
  messageCount: number
  createdAt: string
}

/**
 * Issue summary for tooltip display
 */
export interface FlowGraphIssue {
  id: string
  title: string
  status: string
  type: string
  upvoteCount: number
}

/**
 * Tooltip data for different node types
 */
export interface FlowGraphTooltipData {
  /** Sessions grouped by source for source node tooltips */
  sessionsBySource: Record<string, FlowGraphSession[]>
  /** Issues grouped by status for issue node tooltips */
  issuesByStatus: Record<string, FlowGraphIssue[]>
  /** User details for user node tooltips */
  userDetails: Record<string, FlowGraphUser & { sessions: FlowGraphSession[] }>
}

/**
 * Complete impact flow graph data
 */
export interface ImpactFlowGraphData {
  nodes: FlowGraphNode[]
  links: FlowGraphLink[]
  totals: {
    sessions: number
    issues: number
    conversionRate: number
  }
  users: FlowGraphUser[]
  remainingUsersCount: number
  /** Additional data for rich tooltips */
  tooltipData: FlowGraphTooltipData
}

/**
 * Customer segmentation analytics
 */
export interface CustomerSegmentationAnalytics {
  summary: {
    companiesWithFeedback: number
    contactsWithFeedback: number
    championFeedbackPercentage: number
  }
  companies: {
    bySessionCount: CustomerSegmentationDataPoint[]
    byIssueCount: CustomerSegmentationDataPoint[]
  }
  contacts: {
    bySessionCount: CustomerSegmentationDataPoint[]
    championVsNonChampion: DistributionDataPoint[]
  }
  companyImpactFlow: {
    nodes: FlowGraphNode[]
    links: FlowGraphLink[]
    companies: FlowGraphCompany[]
    remainingCompaniesCount: number
    totals: { sessions: number; issues: number; conversionRate: number }
  }
}

/**
 * Sessions strip analytics (lightweight)
 */
export interface SessionsStripAnalytics {
  total: number
  active: number
  closed: number
  topTags: DistributionPoint[]
  avgMessages: number
  bySource: DistributionPoint[]
}

/**
 * Issues strip analytics (lightweight)
 */
export interface IssuesStripAnalytics {
  total: number
  byStatus: DistributionPoint[]
  topTypes: DistributionPoint[]
  byPriority: DistributionPoint[]
  conversionRate: number
}
