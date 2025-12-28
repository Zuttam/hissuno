/**
 * Test Utilities for PM Agent Integration Tests
 *
 * Provides helper functions for:
 * - Creating test projects and sessions
 * - Seeding test issues
 * - Mocking Supabase calls
 * - Parsing agent responses
 * - Cleanup operations
 */

import type { IssueType, IssuePriority, IssueRecord } from '@/types/issue'
import type { SessionRecord, ChatMessage } from '@/types/session'
import type { PMEvalTestCase, PMEvalSeedIssue } from '@/evals/datasets/types'

/**
 * Generate a random UUID-like string for testing
 */
export function generateTestId(prefix: string = 'test'): string {
  const random = Math.random().toString(36).substring(2, 15)
  return `${prefix}-${random}-${Date.now()}`
}

/**
 * Create a mock session record from a test case
 */
export function createMockSession(
  testCase: PMEvalTestCase,
  projectId: string
): SessionRecord {
  return {
    id: generateTestId('session'),
    project_id: projectId,
    user_id: null,
    user_metadata: testCase.session.userMetadata || null,
    page_url: testCase.session.pageUrl || null,
    page_title: testCase.session.title,
    message_count: testCase.session.messages.length,
    status: 'closed',
    first_message_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    pm_reviewed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

/**
 * Create mock chat messages from a test case
 */
export function createMockMessages(testCase: PMEvalTestCase): ChatMessage[] {
  return testCase.session.messages.map((msg, index) => ({
    id: generateTestId('msg'),
    role: msg.role,
    content: msg.content,
    createdAt: new Date(Date.now() + index * 1000).toISOString(),
  }))
}

/**
 * Create a mock issue record from a seed issue
 */
export function createMockIssue(
  seedIssue: PMEvalSeedIssue,
  projectId: string
): IssueRecord {
  return {
    id: generateTestId('issue'),
    project_id: projectId,
    type: seedIssue.type,
    title: seedIssue.title,
    description: seedIssue.description,
    priority: seedIssue.priority,
    priority_manual_override: false,
    upvote_count: seedIssue.upvoteCount || 0,
    status: 'open',
    product_spec: null,
    product_spec_generated_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

/**
 * Parse PM agent response text to extract structured data
 */
export interface ParsedPMResponse {
  action: 'created' | 'upvoted' | 'skipped'
  classification: IssueType | 'skip' | null
  issueTitle?: string
  issueDescription?: string
  issuePriority?: IssuePriority
  existingIssueId?: string
  skipReason?: string
  thresholdMet?: boolean
  specGenerated?: boolean
}

export function parsePMAgentResponse(responseText: string): ParsedPMResponse {
  const textLower = responseText.toLowerCase()

  // Determine action
  let action: 'created' | 'upvoted' | 'skipped' = 'skipped'
  if (
    (textLower.includes('created') || textLower.includes('creating')) &&
    textLower.includes('issue')
  ) {
    action = 'created'
  } else if (textLower.includes('upvoted') || textLower.includes('upvoting')) {
    action = 'upvoted'
  }

  // Determine classification
  let classification: IssueType | 'skip' | null = null
  if (action === 'skipped') {
    classification = 'skip'
  } else {
    // Check for explicit type mentions
    if (
      textLower.includes('type: bug') ||
      textLower.includes('type:bug') ||
      (textLower.includes('bug') &&
        !textLower.includes('feature') &&
        !textLower.includes('change'))
    ) {
      classification = 'bug'
    } else if (
      textLower.includes('feature request') ||
      textLower.includes('feature_request') ||
      textLower.includes('type: feature')
    ) {
      classification = 'feature_request'
    } else if (
      textLower.includes('change request') ||
      textLower.includes('change_request') ||
      textLower.includes('type: change') ||
      textLower.includes('ux improvement')
    ) {
      classification = 'change_request'
    }
  }

  // Extract issue title
  let issueTitle: string | undefined
  const titlePatterns = [
    /title:\s*["']?([^"'\n]+)["']?/i,
    /issue:\s*["']?([^"'\n]+)["']?/i,
    /creating issue:\s*["']?([^"'\n]+)["']?/i,
  ]
  for (const pattern of titlePatterns) {
    const match = responseText.match(pattern)
    if (match) {
      issueTitle = match[1].trim()
      break
    }
  }

  // Extract priority
  let issuePriority: IssuePriority | undefined
  if (textLower.includes('priority: high') || textLower.includes('high priority')) {
    issuePriority = 'high'
  } else if (
    textLower.includes('priority: medium') ||
    textLower.includes('medium priority')
  ) {
    issuePriority = 'medium'
  } else if (
    textLower.includes('priority: low') ||
    textLower.includes('low priority')
  ) {
    issuePriority = 'low'
  }

  // Extract skip reason
  let skipReason: string | undefined
  if (action === 'skipped') {
    const skipPatterns = [
      /skip(?:ping)?(?:\s+because)?\s*[:.]?\s*(.+?)(?:\.|$)/i,
      /reason(?:\s+for\s+skipping)?:\s*(.+?)(?:\.|$)/i,
      /not actionable(?:\s+because)?\s*[:.]?\s*(.+?)(?:\.|$)/i,
    ]
    for (const pattern of skipPatterns) {
      const match = responseText.match(pattern)
      if (match) {
        skipReason = match[1].trim()
        break
      }
    }
    if (!skipReason) {
      if (textLower.includes('q&a') || textLower.includes('question and answer')) {
        skipReason = 'Simple Q&A session'
      } else if (textLower.includes('few messages') || textLower.includes('short')) {
        skipReason = 'Too few messages'
      } else if (textLower.includes('off-topic') || textLower.includes('irrelevant')) {
        skipReason = 'Off-topic conversation'
      } else {
        skipReason = 'No actionable feedback'
      }
    }
  }

  // Check for threshold and spec generation
  const thresholdMet =
    textLower.includes('threshold') &&
    (textLower.includes('met') || textLower.includes('reached'))
  const specGenerated =
    textLower.includes('spec') &&
    (textLower.includes('generated') || textLower.includes('created'))

  return {
    action,
    classification,
    issueTitle,
    issuePriority,
    skipReason,
    thresholdMet,
    specGenerated,
  }
}

/**
 * Assert that classification matches expected
 */
export function assertClassification(
  actual: ParsedPMResponse,
  expected: PMEvalTestCase['expected']
): { passed: boolean; message: string } {
  if (actual.classification === expected.classification) {
    return { passed: true, message: 'Classification correct' }
  }
  return {
    passed: false,
    message: `Expected classification "${expected.classification}", got "${actual.classification}"`,
  }
}

/**
 * Assert that duplicate detection matches expected
 */
export function assertDuplicateDetection(
  actual: ParsedPMResponse,
  expected: PMEvalTestCase['expected']
): { passed: boolean; message: string } {
  const foundDuplicate = actual.action === 'upvoted'

  if (expected.shouldFindExisting === foundDuplicate) {
    return { passed: true, message: 'Duplicate detection correct' }
  }

  if (expected.shouldFindExisting) {
    return {
      passed: false,
      message: `Expected to find existing issue, but created new one instead`,
    }
  }

  return {
    passed: false,
    message: `Expected to create new issue, but upvoted existing one instead`,
  }
}

/**
 * Assert that issue title matches expected pattern
 */
export function assertTitlePattern(
  actual: ParsedPMResponse,
  expected: PMEvalTestCase['expected']
): { passed: boolean; message: string } {
  if (!expected.issueTitlePattern) {
    return { passed: true, message: 'No title pattern to check' }
  }

  if (!actual.issueTitle) {
    return { passed: false, message: 'No issue title in response' }
  }

  const pattern = new RegExp(expected.issueTitlePattern, 'i')
  if (pattern.test(actual.issueTitle)) {
    return { passed: true, message: 'Title matches expected pattern' }
  }

  return {
    passed: false,
    message: `Title "${actual.issueTitle}" doesn't match pattern "${expected.issueTitlePattern}"`,
  }
}

/**
 * Assert that priority matches expected
 */
export function assertPriority(
  actual: ParsedPMResponse,
  expected: PMEvalTestCase['expected']
): { passed: boolean; message: string } {
  if (!expected.priority) {
    return { passed: true, message: 'No priority to check' }
  }

  if (actual.issuePriority === expected.priority) {
    return { passed: true, message: 'Priority correct' }
  }

  return {
    passed: false,
    message: `Expected priority "${expected.priority}", got "${actual.issuePriority}"`,
  }
}

/**
 * Mock data store for testing without database
 */
export class MockDataStore {
  private sessions: Map<string, SessionRecord> = new Map()
  private messages: Map<string, ChatMessage[]> = new Map()
  private issues: Map<string, IssueRecord> = new Map()
  private issueSessionLinks: Map<string, string[]> = new Map()

  addSession(session: SessionRecord, messages: ChatMessage[]): void {
    this.sessions.set(session.id, session)
    this.messages.set(session.id, messages)
  }

  getSession(id: string): SessionRecord | undefined {
    return this.sessions.get(id)
  }

  getMessages(sessionId: string): ChatMessage[] {
    return this.messages.get(sessionId) || []
  }

  addIssue(issue: IssueRecord): void {
    this.issues.set(issue.id, issue)
  }

  getIssue(id: string): IssueRecord | undefined {
    return this.issues.get(id)
  }

  getAllIssues(): IssueRecord[] {
    return Array.from(this.issues.values())
  }

  findSimilarIssues(query: string, projectId: string): IssueRecord[] {
    const queryLower = query.toLowerCase()
    return this.getAllIssues()
      .filter((issue) => issue.project_id === projectId)
      .filter(
        (issue) =>
          issue.title.toLowerCase().includes(queryLower) ||
          issue.description.toLowerCase().includes(queryLower) ||
          queryLower.includes(issue.title.toLowerCase().split(' ')[0])
      )
  }

  linkSessionToIssue(sessionId: string, issueId: string): void {
    const existing = this.issueSessionLinks.get(issueId) || []
    existing.push(sessionId)
    this.issueSessionLinks.set(issueId, existing)
  }

  getSessionsForIssue(issueId: string): string[] {
    return this.issueSessionLinks.get(issueId) || []
  }

  clear(): void {
    this.sessions.clear()
    this.messages.clear()
    this.issues.clear()
    this.issueSessionLinks.clear()
  }
}

/**
 * Create a test context with mock data
 */
export function createTestContext(seedIssues: PMEvalSeedIssue[] = []): {
  projectId: string
  dataStore: MockDataStore
  issueIdMap: Map<string, string>
} {
  const projectId = generateTestId('project')
  const dataStore = new MockDataStore()
  const issueIdMap = new Map<string, string>()

  // Seed issues
  for (const seedIssue of seedIssues) {
    const issue = createMockIssue(seedIssue, projectId)
    dataStore.addIssue(issue)
    issueIdMap.set(seedIssue.id, issue.id)
  }

  return { projectId, dataStore, issueIdMap }
}

/**
 * Format test results for console output
 */
export function formatTestResult(
  testCase: PMEvalTestCase,
  passed: boolean,
  details: string[]
): string {
  const status = passed ? '✅ PASS' : '❌ FAIL'
  const header = `${status} [${testCase.id}] ${testCase.name}`
  const detailLines = details.map((d) => `       ${d}`).join('\n')
  return `${header}\n${detailLines}`
}
