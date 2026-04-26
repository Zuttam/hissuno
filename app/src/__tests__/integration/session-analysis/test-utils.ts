// @ts-nocheck -- TODO: type drift unrelated to Mastra v1, re-enable after fixture cleanup
/**
 * Test Utilities for Session Review Integration Tests
 *
 * Provides helper functions for:
 * - Creating test projects and sessions
 * - Seeding test issues
 * - Mocking Supabase calls
 * - Parsing agent responses for both session tagging and PM review
 * - Cleanup operations
 *
 * IMPORTANT DISTINCTION:
 * - Session Tags: general_feedback, wins, losses, bug, feature_request, change_request
 *   These are applied to SESSIONS to classify the nature of the conversation.
 *
 * - PM Issue Types: bug, feature_request, change_request
 *   These are the types of ISSUES created from actionable feedback.
 *
 * Session tags and PM issue types overlap for actionable feedback types,
 * but session tags also include non-actionable classifications (wins, losses, general_feedback).
 */

import type { IssueType, IssuePriority, IssueRecord } from '@/types/issue'
import type { SessionRecord, ChatMessage, SessionTag } from '@/types/session'
import type { PMEvalTestCase, PMEvalSeedIssue } from '@/evals/datasets/types'

// ============================================================================
// SESSION TAG TYPES (from session-review workflow)
// ============================================================================

/**
 * All available session tags.
 * Note: bug, feature_request, change_request overlap with PM issue types
 */
export const SESSION_TAGS = [
  'general_feedback',
  'wins',
  'losses',
  'bug',
  'feature_request',
  'change_request',
] as const

export type SessionTagType = (typeof SESSION_TAGS)[number]

/**
 * Tags that indicate potentially actionable feedback (may create PM issues)
 */
export const ACTIONABLE_SESSION_TAGS: SessionTagType[] = ['bug', 'feature_request', 'change_request']

/**
 * Tags that indicate sentiment/experience (non-actionable)
 */
export const SENTIMENT_SESSION_TAGS: SessionTagType[] = ['wins', 'losses', 'general_feedback']

// ============================================================================
// PM ISSUE TYPES (for issue creation)
// ============================================================================

export const PM_ISSUE_TYPES = ['bug', 'feature_request', 'change_request'] as const
export type PMIssueType = (typeof PM_ISSUE_TYPES)[number]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
    user_metadata: testCase.session.userMetadata || null,
    page_url: testCase.session.pageUrl || null,
    page_title: testCase.session.title,
    name: null,
    description: null,
    source: 'widget',
    session_type: 'chat',
    message_count: testCase.session.messages.length,
    status: 'closed',
    first_message_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    tags: [],
    custom_fields: {},
    goodbye_detected_at: null,
    idle_prompt_sent_at: null,
    scheduled_close_at: null,
    is_archived: false,
    is_human_takeover: false,
    human_takeover_at: null,
    human_takeover_user_id: null,
    human_takeover_slack_channel_id: null,
    human_takeover_slack_thread_ts: null,
    base_processed_at: null,
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
    name: seedIssue.name,
    description: seedIssue.description,
    priority: seedIssue.priority,
    priority_manual_override: false,
    session_count: seedIssue.upvoteCount || 0,
    status: 'open',
    brief: null,
    brief_generated_at: null,
    is_archived: false,
    custom_fields: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // Impact/effort fields
    impact_score: null,
    impact_analysis: null,
    effort_estimate: null,
    effort_reasoning: null,
    // Analysis metrics
    reach_score: null,
    reach_reasoning: null,
    effort_score: null,
    confidence_score: null,
    confidence_reasoning: null,
    analysis_computed_at: null,
  }
}

// ============================================================================
// PARSED RESPONSE TYPES
// ============================================================================

/**
 * Parsed result from session classification (tagging) step
 */
export interface ParsedSessionTaggingResult {
  tags: string[]  // Changed to string[] to support custom tags
  tagsApplied: boolean
  reasoning: string
  hasActionableTags: boolean
  hasSentimentTags: boolean
  hasCustomTags: boolean  // NEW: indicates if any custom tags are present
}

/**
 * Parsed result from PM review (issue creation) step
 */
export interface ParsedPMReviewResult {
  action: 'created' | 'upvoted' | 'skipped'
  issueType: PMIssueType | null
  issueTitle?: string
  issueDescription?: string
  issuePriority?: IssuePriority
  existingIssueId?: string
  skipReason?: string
}

/**
 * Combined result from full session-review workflow
 */
export interface ParsedSessionReviewResult {
  tagging: ParsedSessionTaggingResult
  pmReview: ParsedPMReviewResult
}

// ============================================================================
// RESPONSE PARSING FUNCTIONS
// ============================================================================

/**
 * Get valid native tags
 */
export function getValidTags(): string[] {
  return [...SESSION_TAGS]
}

/**
 * Parse session tagging (classification) response
 * @param responseText - The raw response text from the tagging agent
 */
export function parseSessionTaggingResponse(
  responseText: string,
): ParsedSessionTaggingResult {
  const textLower = responseText.toLowerCase()
  const tags: string[] = []

  const allValidTags = new Set<string>(SESSION_TAGS as readonly string[])

  // Try to extract JSON
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed.tags)) {
        for (const t of parsed.tags) {
          if (allValidTags.has(t)) {
            tags.push(t)
          }
        }
      }
    } catch {
      // Fall through to text detection
    }
  }

  // Fallback: detect native tags from text (custom tags require explicit mention)
  if (tags.length === 0) {
    if (textLower.includes('general_feedback') || textLower.includes('general feedback')) {
      tags.push('general_feedback')
    }
    if (textLower.includes('wins') || textLower.includes('satisfied') || textLower.includes('thank')) {
      tags.push('wins')
    }
    if (textLower.includes('losses') || textLower.includes('frustrated') || textLower.includes('disappointed')) {
      tags.push('losses')
    }
    if (textLower.includes('bug') || textLower.includes('error') || textLower.includes('broken')) {
      tags.push('bug')
    }
    if (textLower.includes('feature_request') || textLower.includes('feature request') || textLower.includes('new feature')) {
      tags.push('feature_request')
    }
    if (textLower.includes('change_request') || textLower.includes('change request') || textLower.includes('ux improvement')) {
      tags.push('change_request')
    }

  }

  // Extract reasoning
  let reasoning = 'No specific reasoning provided'
  const reasoningPatterns = [
    /reasoning:\s*["']?([^"'\n]+)["']?/i,
    /because\s+(.+?)(?:\.|$)/i,
  ]
  for (const pattern of reasoningPatterns) {
    const match = responseText.match(pattern)
    if (match) {
      reasoning = match[1].trim()
      break
    }
  }

  return {
    tags,
    tagsApplied: tags.length > 0,
    reasoning,
    hasActionableTags: tags.some((t) => ACTIONABLE_SESSION_TAGS.includes(t as SessionTagType)),
    hasSentimentTags: tags.some((t) => SENTIMENT_SESSION_TAGS.includes(t as SessionTagType)),
    hasCustomTags: false,
  }
}

/**
 * Parse PM review (issue creation) response
 */
export function parsePMReviewResponse(responseText: string): ParsedPMReviewResult {
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

  // Determine issue type
  let issueType: PMIssueType | null = null
  if (action !== 'skipped') {
    if (
      textLower.includes('type: bug') ||
      textLower.includes('type:bug') ||
      (textLower.includes('bug') &&
        !textLower.includes('feature') &&
        !textLower.includes('change'))
    ) {
      issueType = 'bug'
    } else if (
      textLower.includes('feature request') ||
      textLower.includes('feature_request') ||
      textLower.includes('type: feature')
    ) {
      issueType = 'feature_request'
    } else if (
      textLower.includes('change request') ||
      textLower.includes('change_request') ||
      textLower.includes('type: change') ||
      textLower.includes('ux improvement')
    ) {
      issueType = 'change_request'
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

  return {
    action,
    issueType,
    issueTitle,
    issuePriority,
    skipReason,
  }
}

/**
 * Legacy parser for backward compatibility
 * Maps to PM review result format
 */
export interface ParsedPMResponse {
  action: 'created' | 'upvoted' | 'skipped'
  classification: IssueType | 'skip' | null
  issueTitle?: string
  issueDescription?: string
  issuePriority?: IssuePriority
  existingIssueId?: string
  skipReason?: string
}

export function parsePMAgentResponse(responseText: string): ParsedPMResponse {
  const pmResult = parsePMReviewResponse(responseText)
  return {
    action: pmResult.action,
    classification: pmResult.action === 'skipped' ? 'skip' : pmResult.issueType,
    issueTitle: pmResult.issueTitle,
    issuePriority: pmResult.issuePriority,
    skipReason: pmResult.skipReason,
  }
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that session tags match expected
 */
export function assertSessionTags(
  actual: ParsedSessionTaggingResult,
  expectedTags: string[]
): { passed: boolean; message: string } {
  const actualSet = new Set(actual.tags)
  const expectedSet = new Set(expectedTags)

  // Check if all expected tags are present
  const missingTags = expectedTags.filter((t) => !actualSet.has(t))
  const extraTags = actual.tags.filter((t) => !expectedSet.has(t))

  if (missingTags.length === 0 && extraTags.length === 0) {
    return { passed: true, message: 'Session tags correct' }
  }

  let message = ''
  if (missingTags.length > 0) {
    message += `Missing tags: ${missingTags.join(', ')}. `
  }
  if (extraTags.length > 0) {
    message += `Unexpected tags: ${extraTags.join(', ')}.`
  }

  return { passed: false, message: message.trim() }
}

/**
 * Assert that at least one of the expected tags is present (flexible matching)
 */
export function assertHasAnyTag(
  actual: ParsedSessionTaggingResult,
  expectedTags: string[]
): { passed: boolean; message: string } {
  const hasAny = expectedTags.some((t) => actual.tags.includes(t))

  if (hasAny) {
    return { passed: true, message: `Found one of: ${expectedTags.join(', ')}` }
  }

  return {
    passed: false,
    message: `Expected one of [${expectedTags.join(', ')}], got [${actual.tags.join(', ')}]`,
  }
}

/**
 * Assert that PM issue classification matches expected
 */
export function assertPMClassification(
  actual: ParsedPMReviewResult,
  expected: PMEvalTestCase['expected']
): { passed: boolean; message: string } {
  // If expected to skip
  if (expected.classification === 'skip') {
    if (actual.action === 'skipped') {
      return { passed: true, message: 'Correctly skipped' }
    }
    return {
      passed: false,
      message: `Expected to skip, but action was "${actual.action}"`,
    }
  }

  // If expected to create/upvote
  if (actual.action === 'skipped') {
    return {
      passed: false,
      message: `Expected action for "${expected.classification}", but was skipped`,
    }
  }

  if (actual.issueType === expected.classification) {
    return { passed: true, message: 'PM classification correct' }
  }

  return {
    passed: false,
    message: `Expected PM classification "${expected.classification}", got "${actual.issueType}"`,
  }
}

/**
 * Legacy assertion for backward compatibility
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
  const shouldFindExisting = expected.shouldFindExisting ?? false

  if (shouldFindExisting === foundDuplicate) {
    return { passed: true, message: 'Duplicate detection correct' }
  }

  if (shouldFindExisting) {
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

// ============================================================================
// MOCK DATA STORE
// ============================================================================

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
          issue.name.toLowerCase().includes(queryLower) ||
          issue.description.toLowerCase().includes(queryLower) ||
          queryLower.includes(issue.name.toLowerCase().split(' ')[0])
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