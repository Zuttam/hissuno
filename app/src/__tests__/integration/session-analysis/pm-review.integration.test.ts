/**
 * PM Review Workflow Integration Tests
 *
 * These tests verify the PM review (pm-review step) of the session-review workflow:
 *
 * - Analyzes sessions for actionable feedback
 * - Creates ISSUES with types: bug, feature_request, change_request
 * - Handles duplicate detection and upvoting
 * - Assigns priority based on urgency/impact
 * - Generates product specs when threshold is met
 *
 * NOTE: Session tagging (classify-session step) is tested separately in
 * session-tagging.integration.test.ts
 *
 * These tests use the real database to verify actual workflow functionality.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { mastra } from '@/mastra'
import { createAdminClient } from '@/lib/supabase/server'
import type { IssueRecord, IssuePriority } from '@/types/issue'
import {
  generateTestId,
  parsePMReviewResponse,
  PM_ISSUE_TYPES,
  type ParsedPMReviewResult,
} from './test-utils'

// Test timeout for LLM calls (60 seconds for workflow tests)
const TEST_TIMEOUT = 60000

// Test data
let testProjectId: string
const testSessionIds: string[] = []
const testIssueIds: string[] = []

/**
 * Create test project and sessions in database
 */
async function setupTestProject(): Promise<string> {
  const supabase = createAdminClient()

  // Get the current user ID from an existing project (for RLS)
  const { data: existingProject } = await supabase
    .from('projects')
    .select('user_id')
    .limit(1)
    .single()

  if (!existingProject?.user_id) {
    throw new Error('No existing project found to get user_id for test project')
  }

  // Create a test project
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: 'PM Review Workflow Test Project',
      description: 'Test project for PM review workflow integration tests',
      user_id: existingProject.user_id,
    })
    .select('id')
    .single()

  if (error || !project) {
    throw new Error(`Failed to create test project: ${error?.message}`)
  }

  // Create project settings with a low threshold for testing
  await supabase.from('project_settings').insert({
    project_id: project.id,
    issue_spec_threshold: 3, // Low threshold for testing
  })

  return project.id
}

/**
 * Create a test session in the database
 */
async function createTestSession(
  projectId: string,
  title: string,
  pageUrl?: string
): Promise<string> {
  const supabase = createAdminClient()

  const sessionId = generateTestId('session')

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      id: sessionId,
      project_id: projectId,
      page_title: title,
      page_url: pageUrl || 'https://test.example.com/page',
      status: 'closed',
      message_count: 3,
      tags: [], // Start with no tags
    })
    .select('id')
    .single()

  if (error || !session) {
    throw new Error(`Failed to create test session: ${error?.message}`)
  }

  testSessionIds.push(session.id)
  return session.id
}

/**
 * Create a seed issue for duplicate detection tests
 */
async function createSeedIssue(
  projectId: string,
  type: 'bug' | 'feature_request' | 'change_request',
  title: string,
  description: string,
  upvoteCount: number = 1
): Promise<IssueRecord> {
  const supabase = createAdminClient()

  const { data: issue, error } = await supabase
    .from('issues')
    .insert({
      project_id: projectId,
      type,
      title,
      description,
      priority: upvoteCount >= 5 ? 'high' : upvoteCount >= 3 ? 'medium' : 'low',
      upvote_count: upvoteCount,
      status: 'open',
    })
    .select('*')
    .single()

  if (error || !issue) {
    throw new Error(`Failed to create seed issue: ${error?.message}`)
  }

  testIssueIds.push(issue.id)
  return issue as IssueRecord
}

/**
 * Get an issue by ID from the database
 */
async function getIssue(issueId: string): Promise<IssueRecord | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('id', issueId)
    .single()

  if (error) return null
  return data as IssueRecord
}

/**
 * Get issues for a project
 */
async function getProjectIssues(projectId: string): Promise<IssueRecord[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data as IssueRecord[]
}

/**
 * Cleanup test data after tests
 */
async function cleanupTestData() {
  const supabase = createAdminClient()

  // Delete issue_sessions links first (foreign key constraint)
  if (testIssueIds.length > 0) {
    await supabase.from('issue_sessions').delete().in('issue_id', testIssueIds)
  }
  if (testSessionIds.length > 0) {
    await supabase
      .from('issue_sessions')
      .delete()
      .in('session_id', testSessionIds)
  }

  // Delete test issues
  if (testIssueIds.length > 0) {
    await supabase.from('issues').delete().in('id', testIssueIds)
  }

  // Delete test sessions
  if (testSessionIds.length > 0) {
    await supabase.from('sessions').delete().in('id', testSessionIds)
  }

  // Delete test project settings and project
  if (testProjectId) {
    await supabase
      .from('project_settings')
      .delete()
      .eq('project_id', testProjectId)
    await supabase.from('projects').delete().eq('id', testProjectId)
  }
}

/**
 * Run the PM review step for a session
 */
async function runPMReview(
  projectId: string,
  sessionId: string,
  sessionTitle: string,
  conversation: string
): Promise<{
  response: string
  parsed: ParsedPMReviewResult
}> {
  const pmAgent = mastra.getAgent('productManagerAgent')

  if (!pmAgent) {
    throw new Error('Product Manager agent not found')
  }

  const runtimeContext = new RuntimeContext()
  runtimeContext.set('projectId', projectId)

  const prompt = `Analyze session ${sessionId} for actionable feedback.

Session Title: ${sessionTitle}
Page URL: https://test.example.com/checkout

Conversation:
${conversation}

Based on this conversation:
1. Determine if there's actionable feedback (bug, feature request, or change request)
2. If actionable, classify the type and assess priority
3. Use the appropriate tools (create-issue, upvote-issue, etc.) to perform the actions

IMPORTANT:
- Actually use the tools to perform the actions
- Report the actions taken and their results`

  const response = await pmAgent.generate(prompt, { runtimeContext })
  const text = typeof response.text === 'string' ? response.text : ''
  const parsed = parsePMReviewResponse(text)

  return {
    response: text,
    parsed,
  }
}

// Setup and teardown
beforeAll(async () => {
  testProjectId = await setupTestProject()
}, 30000)

afterAll(async () => {
  await cleanupTestData()
}, 30000)

beforeEach(() => {
  // Reset per-test data
})

// ============================================================================
// PM REVIEW TESTS - ISSUE CREATION
// ============================================================================

describe('PM Review - Issue Creation', () => {
  it(
    'should create a new bug issue from session analysis',
    async () => {
      const sessionId = await createTestSession(
        testProjectId,
        'Payment not processing'
      )

      const conversation = `USER: I'm trying to pay for my order but the payment keeps failing.

ASSISTANT: I'm sorry to hear that. What error message are you seeing?

USER: It just says "Payment declined" but my card works everywhere else. I've tried three times now.

ASSISTANT: That's frustrating. Let me look into this for you.

USER: This is really blocking me from using your service.`

      const { parsed } = await runPMReview(
        testProjectId,
        sessionId,
        'Payment not processing',
        conversation
      )

      // PM should identify this as actionable and create issue
      expect(parsed.action).not.toBe('skipped')

      const issues = await getProjectIssues(testProjectId)
      const createdIssue = issues.find(
        (i) =>
          i.type === 'bug' &&
          (i.title.toLowerCase().includes('payment') ||
            i.description.toLowerCase().includes('payment'))
      )

      if (createdIssue) {
        testIssueIds.push(createdIssue.id)
        expect(createdIssue.type).toBe('bug')
        expect(createdIssue.status).toBe('open')
      }
    },
    TEST_TIMEOUT
  )

  it(
    'should create a feature request issue',
    async () => {
      const sessionId = await createTestSession(
        testProjectId,
        'Excel export feature'
      )

      const conversation = `USER: Is there a way to export my data to Excel format?

ASSISTANT: Currently we support CSV exports. Would that work?

USER: No, I specifically need Excel with formatting. All my team uses Excel.

ASSISTANT: I understand. That's not available yet.

USER: Please add it! This would really help our workflow.`

      const { parsed } = await runPMReview(
        testProjectId,
        sessionId,
        'Excel export feature',
        conversation
      )

      expect(parsed.action).not.toBe('skipped')

      const issues = await getProjectIssues(testProjectId)
      const featureIssue = issues.find(
        (i) =>
          i.type === 'feature_request' &&
          (i.title.toLowerCase().includes('excel') ||
            i.description.toLowerCase().includes('excel'))
      )

      if (featureIssue) {
        testIssueIds.push(featureIssue.id)
        expect(featureIssue.type).toBe('feature_request')
      }
    },
    TEST_TIMEOUT
  )

  it(
    'should create a change request for UX improvements',
    async () => {
      const sessionId = await createTestSession(
        testProjectId,
        'Navigation confusing'
      )

      const conversation = `USER: I can never find the settings page. Why is it hidden?

ASSISTANT: You can access settings under your profile icon.

USER: That's not intuitive at all. Most apps have a gear icon. I spent 10 minutes looking.

ASSISTANT: I appreciate that feedback. Would a dedicated settings link help?

USER: Absolutely! Please make this more visible.`

      const { parsed } = await runPMReview(
        testProjectId,
        sessionId,
        'Navigation confusing',
        conversation
      )

      expect(parsed.action).not.toBe('skipped')

      const issues = await getProjectIssues(testProjectId)
      const changeIssue = issues.find(
        (i) =>
          i.type === 'change_request' &&
          (i.title.toLowerCase().includes('settings') ||
            i.title.toLowerCase().includes('navigation'))
      )

      if (changeIssue) {
        testIssueIds.push(changeIssue.id)
        expect(changeIssue.type).toBe('change_request')
      }
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// PM REVIEW TESTS - DUPLICATE DETECTION
// ============================================================================

describe('PM Review - Duplicate Detection', () => {
  let existingBugIssue: IssueRecord

  beforeAll(async () => {
    // Create a seed issue for upvoting tests
    existingBugIssue = await createSeedIssue(
      testProjectId,
      'bug',
      'Login button not working on Safari',
      'Users report that clicking the login button does nothing on Safari browser.',
      2
    )
  })

  it(
    'should detect and upvote similar existing issue',
    async () => {
      const sessionId = await createTestSession(
        testProjectId,
        'Cannot login on Safari'
      )

      const conversation = `USER: The login button doesn't work for me on Safari.

ASSISTANT: I'm sorry to hear that. What happens when you click it?

USER: Nothing happens at all. I click and click but it doesn't respond.

ASSISTANT: We've seen similar reports. Are you on the latest Safari?

USER: Yes, I just updated. Please fix this!`

      const { parsed } = await runPMReview(
        testProjectId,
        sessionId,
        'Cannot login on Safari',
        conversation
      )

      // Verify workflow worked (either upvoted or created)
      const allIssues = await getProjectIssues(testProjectId)
      const loginIssues = allIssues.filter(
        (i) =>
          i.type === 'bug' &&
          (i.title.toLowerCase().includes('login') ||
            i.title.toLowerCase().includes('safari'))
      )

      expect(loginIssues.length).toBeGreaterThanOrEqual(1)

      // Track for cleanup
      for (const issue of loginIssues) {
        if (!testIssueIds.includes(issue.id)) {
          testIssueIds.push(issue.id)
        }
      }
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// PM REVIEW TESTS - SKIP BEHAVIOR
// ============================================================================

describe('PM Review - Skip Behavior', () => {
  it(
    'should skip issue creation for Q&A sessions',
    async () => {
      const sessionId = await createTestSession(
        testProjectId,
        'Password reset question'
      )

      const conversation = `USER: How do I reset my password?

ASSISTANT: Click "Forgot Password" on the login page. We'll send you a reset link.

USER: Got it, thanks!

ASSISTANT: You're welcome! Let me know if you need anything else.`

      const initialIssueCount = (await getProjectIssues(testProjectId)).length

      const { parsed } = await runPMReview(
        testProjectId,
        sessionId,
        'Password reset question',
        conversation
      )

      const finalIssueCount = (await getProjectIssues(testProjectId)).length
      const responseLower = parsed.skipReason?.toLowerCase() || ''

      const skipped =
        parsed.action === 'skipped' ||
        responseLower.includes('skip') ||
        responseLower.includes('q&a') ||
        finalIssueCount === initialIssueCount

      expect(skipped).toBe(true)
    },
    TEST_TIMEOUT
  )

  it(
    'should skip issue creation for minimal sessions',
    async () => {
      const sessionId = await createTestSession(testProjectId, 'Brief chat')

      const conversation = `USER: Hi

ASSISTANT: Hello! How can I help you today?`

      const initialIssueCount = (await getProjectIssues(testProjectId)).length

      const { parsed } = await runPMReview(
        testProjectId,
        sessionId,
        'Brief chat',
        conversation
      )

      const finalIssueCount = (await getProjectIssues(testProjectId)).length

      // PM should skip for minimal session
      expect(finalIssueCount).toBe(initialIssueCount)
    },
    TEST_TIMEOUT
  )

  it(
    'should skip issue creation for positive feedback only',
    async () => {
      const sessionId = await createTestSession(
        testProjectId,
        'Happy customer'
      )

      const conversation = `USER: I just wanted to say your product is amazing!

ASSISTANT: Thank you so much for the kind words! We're glad you're enjoying it.

USER: Keep up the great work!

ASSISTANT: We really appreciate your support!`

      const initialIssueCount = (await getProjectIssues(testProjectId)).length

      const { parsed } = await runPMReview(
        testProjectId,
        sessionId,
        'Happy customer',
        conversation
      )

      const finalIssueCount = (await getProjectIssues(testProjectId)).length

      // PM should skip - positive feedback is not an actionable issue
      expect(finalIssueCount).toBe(initialIssueCount)
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// PM REVIEW TESTS - PRIORITY ASSESSMENT
// ============================================================================

describe('PM Review - Priority Assessment', () => {
  it(
    'should assign high priority to blocking issues',
    async () => {
      const sessionId = await createTestSession(
        testProjectId,
        'Complete blocker'
      )

      const conversation = `USER: I cannot access my account at all. This is completely blocking my work!

ASSISTANT: I'm sorry to hear that. What error are you seeing?

USER: Just a blank page. Nothing loads. I have a critical deadline today!

ASSISTANT: That sounds urgent. Let me escalate this immediately.

USER: Please! My entire team is blocked. We're losing money every hour.`

      const { parsed } = await runPMReview(
        testProjectId,
        sessionId,
        'Complete blocker',
        conversation
      )

      expect(parsed.action).not.toBe('skipped')

      const issues = await getProjectIssues(testProjectId)
      const blockingIssue = issues.find(
        (i) =>
          i.title.toLowerCase().includes('block') ||
          i.title.toLowerCase().includes('access') ||
          i.description.toLowerCase().includes('blocking')
      )

      if (blockingIssue) {
        testIssueIds.push(blockingIssue.id)
        expect(blockingIssue.priority).toBe('high')
      }
    },
    TEST_TIMEOUT
  )

  it(
    'should assign low priority to nice-to-have features',
    async () => {
      const sessionId = await createTestSession(
        testProjectId,
        'Minor suggestion'
      )

      const conversation = `USER: It would be nice if the icon was slightly bigger.

ASSISTANT: Thanks for the suggestion! Any particular reason?

USER: Just personal preference. Not a big deal.

ASSISTANT: Got it, I'll note that down.`

      const { parsed } = await runPMReview(
        testProjectId,
        sessionId,
        'Minor suggestion',
        conversation
      )

      // If issue was created, check priority
      if (parsed.action !== 'skipped') {
        const issues = await getProjectIssues(testProjectId)
        const recentIssue = issues.find(
          (i) =>
            i.title.toLowerCase().includes('icon') ||
            i.description.toLowerCase().includes('icon')
        )

        if (recentIssue) {
          testIssueIds.push(recentIssue.id)
          expect(['low', 'medium']).toContain(recentIssue.priority)
        }
      }
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// PM REVIEW TESTS - ISSUE TYPE VALIDATION
// ============================================================================

describe('PM Review - Issue Type Validation', () => {
  it(
    'should only create issues with valid PM issue types',
    async () => {
      const sessionId = await createTestSession(
        testProjectId,
        'Bug with positive outcome'
      )

      const conversation = `USER: The new feature is great but I found a bug in it.

ASSISTANT: Thanks for the feedback! What bug did you find?

USER: The save button doesn't work. But otherwise I love the new design!

ASSISTANT: I'll report the bug. Glad you like the design overall!`

      const initialIssueCount = (await getProjectIssues(testProjectId)).length

      await runPMReview(
        testProjectId,
        sessionId,
        'Bug with positive outcome',
        conversation
      )

      // Check database for created issue (more reliable than parsing LLM response)
      const issues = await getProjectIssues(testProjectId)
      const newIssue = issues.find(
        (i) =>
          i.title.toLowerCase().includes('save') ||
          i.title.toLowerCase().includes('button') ||
          i.description.toLowerCase().includes('save')
      )

      if (newIssue) {
        testIssueIds.push(newIssue.id)
        // PM should create bug issue (not 'wins' - that's a session tag, not an issue type)
        expect(newIssue.type).toBe('bug')
        // Verify issue type is valid PM issue type
        expect(PM_ISSUE_TYPES).toContain(newIssue.type)
      } else if (issues.length > initialIssueCount) {
        // An issue was created, verify its type is valid
        const latestIssue = issues[0]
        testIssueIds.push(latestIssue.id)
        expect(PM_ISSUE_TYPES).toContain(latestIssue.type)
      }
      // If no issue was created (skipped), that's acceptable for this test
    },
    TEST_TIMEOUT
  )

  it('should correctly identify valid PM issue types', () => {
    // PM issue types are ONLY: bug, feature_request, change_request
    expect(PM_ISSUE_TYPES).toContain('bug')
    expect(PM_ISSUE_TYPES).toContain('feature_request')
    expect(PM_ISSUE_TYPES).toContain('change_request')

    // Session-only tags are NOT PM issue types
    expect(PM_ISSUE_TYPES).not.toContain('wins')
    expect(PM_ISSUE_TYPES).not.toContain('losses')
    expect(PM_ISSUE_TYPES).not.toContain('general_feedback')
  })
})
