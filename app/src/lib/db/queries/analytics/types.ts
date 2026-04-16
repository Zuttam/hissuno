import type { EntityType } from '../types'

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

/**
 * Distribution data point
 */
export interface DistributionDataPoint {
  label: string
  value: number
  percentage: number
}

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
    sessionsBySource: DistributionDataPoint[]
    sessionsByTag: DistributionDataPoint[]
    issuesByType: DistributionDataPoint[]
    issuesByPriority: DistributionDataPoint[]
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
  knowledgeAdded: {
    value: number
    change?: number
  }
  affectedProducts: {
    value: number
    change?: number
  }
  topTag: string | null
  timeSeries: {
    sessions: TimeSeriesPoint[]
  }
  distributions: {
    sessionsByTag: DistributionDataPoint[]
    sessionsBySource: DistributionDataPoint[]
    issuesByType: DistributionDataPoint[]
    issuesByPriority: DistributionDataPoint[]
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
}

/**
 * Sessions strip analytics (lightweight)
 */
export interface SessionsStripAnalytics {
  total: number
  active: number
  closed: number
  topTags: DistributionDataPoint[]
  avgMessages: number
  bySource: DistributionDataPoint[]
}

/**
 * Issues strip analytics (lightweight)
 */
export interface IssuesStripAnalytics {
  total: number
  byStatus: DistributionDataPoint[]
  topTypes: DistributionDataPoint[]
  byPriority: DistributionDataPoint[]
  conversionRate: number
}

export type { EntityType }
