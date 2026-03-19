/**
 * PM Agent Evaluation Dataset Types
 *
 * These types define the structure of test cases for evaluating
 * the Product Manager agent's ability to classify sessions and manage issues.
 */

import type { IssueType, IssuePriority } from '@/types/issue'

/**
 * Role type for messages in test sessions
 */
export type MessageRole = 'user' | 'assistant' | 'system'

/**
 * A message in a test session conversation
 */
export interface TestMessage {
  role: MessageRole
  content: string
}

/**
 * Expected classification result for a session
 */
export type ExpectedClassification = IssueType | 'skip'

/**
 * Expected outcome of PM agent analysis
 */
export interface PMEvalExpectedOutcome {
  /**
   * Expected classification type
   */
  classification: ExpectedClassification

  /**
   * Whether the agent should find an existing issue to upvote.
   * Defaults to false when not specified.
   */
  shouldFindExisting?: boolean

  /**
   * ID of existing issue that should be found (for duplicate detection tests)
   * Only relevant when shouldFindExisting is true
   */
  existingIssueId?: string

  /**
   * Expected title pattern (regex or substring) for created issues
   * Used to verify issue quality
   */
  issueTitlePattern?: string

  /**
   * Expected priority level for the issue
   */
  priority?: IssuePriority

  /**
   * Keywords that should appear in the issue description
   */
  descriptionKeywords?: string[]

  /**
   * Reason for skipping (when classification is 'skip')
   */
  skipReason?: string
}

/**
 * A single test case for PM agent evaluation
 */
export interface PMEvalTestCase {
  /**
   * Unique identifier for the test case
   */
  id: string

  /**
   * Human-readable name of the test case
   */
  name: string

  /**
   * Description of what this test case is evaluating
   */
  description: string

  /**
   * Session data to be analyzed
   */
  session: {
    /**
     * Title/summary of the session
     */
    title: string

    /**
     * Page URL where the session occurred
     */
    pageUrl?: string

    /**
     * User metadata (optional)
     */
    userMetadata?: Record<string, string>

    /**
     * The conversation messages
     */
    messages: TestMessage[]
  }

  /**
   * Expected outcome from the PM agent
   */
  expected: PMEvalExpectedOutcome

  /**
   * Tags for filtering test cases
   * e.g., 'classification', 'duplicate', 'edge-case', 'bug', 'feature', 'change', 'skip'
   */
  tags: string[]
}

/**
 * Seed issue for duplicate detection tests
 * These issues should exist in the system before running duplicate detection tests
 */
export interface PMEvalSeedIssue {
  /**
   * Temporary ID for reference in test cases
   */
  id: string

  /**
   * Issue type
   */
  type: IssueType

  /**
   * Issue title
   */
  title: string

  /**
   * Issue description
   */
  description: string

  /**
   * Issue priority
   */
  priority: IssuePriority

  /**
   * Current upvote count
   */
  upvoteCount?: number
}

/**
 * Complete evaluation dataset including seed issues and test cases
 */
export interface PMEvalDataset {
  /**
   * Dataset version for tracking changes
   */
  version: string

  /**
   * Description of the dataset
   */
  description: string

  /**
   * Seed issues to create before running duplicate detection tests
   */
  seedIssues: PMEvalSeedIssue[]

  /**
   * Test cases for evaluation
   */
  testCases: PMEvalTestCase[]
}

/**
 * Result of a single evaluation run
 */
export interface PMEvalResult {
  /**
   * Test case ID
   */
  testCaseId: string

  /**
   * Whether the classification matched expected
   */
  classificationCorrect: boolean

  /**
   * Actual classification from agent
   */
  actualClassification: ExpectedClassification | null

  /**
   * Whether duplicate detection was correct
   */
  duplicateDetectionCorrect: boolean

  /**
   * Whether an existing issue was found
   */
  foundExistingIssue: boolean

  /**
   * ID of issue found (if any)
   */
  foundIssueId?: string

  /**
   * Whether issue title matches expected pattern
   */
  titlePatternMatched: boolean

  /**
   * Whether priority was correct
   */
  priorityCorrect: boolean

  /**
   * Any error that occurred
   */
  error?: string

  /**
   * Raw agent response
   */
  rawResponse?: string
}

/**
 * Aggregate evaluation metrics
 */
export interface PMEvalMetrics {
  /**
   * Total number of test cases
   */
  total: number

  /**
   * Number of passed tests
   */
  passed: number

  /**
   * Classification accuracy (0-1)
   */
  classificationAccuracy: number

  /**
   * Duplicate detection precision (0-1)
   */
  duplicatePrecision: number

  /**
   * Duplicate detection recall (0-1)
   */
  duplicateRecall: number

  /**
   * Priority accuracy (0-1)
   */
  priorityAccuracy: number

  /**
   * Results by classification type
   */
  byClassification: {
    [K in ExpectedClassification]?: {
      total: number
      correct: number
      accuracy: number
    }
  }
}
