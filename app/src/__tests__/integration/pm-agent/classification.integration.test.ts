/**
 * PM Agent Integration Tests
 *
 * These tests verify that the PM agent correctly:
 * 1. Classifies sessions into appropriate issue types
 * 2. Detects duplicate issues and upvotes them
 * 3. Creates well-structured issues with appropriate content
 * 4. Skips sessions that don't contain actionable feedback
 *
 * Tests use the evaluation dataset and run against the actual PM agent.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { mastra } from '@/mastra'
import {
  pmEvalDataset,
  getTestCasesByClassification,
  getDuplicateTestCases,
  getEdgeCases,
} from '@/evals/datasets/pm-agent-dataset'
import type { PMEvalTestCase } from '@/evals/datasets/types'
import {
  parsePMAgentResponse,
  assertClassification,
  assertDuplicateDetection,
  assertTitlePattern,
  assertPriority,
  createTestContext,
  type ParsedPMResponse,
} from './test-utils'

// Test timeout for LLM calls (30 seconds)
const TEST_TIMEOUT = 30000

// Test project context
let testProjectId: string

beforeAll(() => {
  const { projectId } = createTestContext(pmEvalDataset.seedIssues)
  testProjectId = projectId
})

afterAll(() => {
  // Cleanup if needed
})

/**
 * Helper to run PM agent on a test case
 */
async function runPMAgentOnTestCase(
  testCase: PMEvalTestCase
): Promise<{ response: string; parsed: ParsedPMResponse }> {
  const pmAgent = mastra.getAgent('productManagerAgent')

  if (!pmAgent) {
    throw new Error('Product Manager agent not found')
  }

  const runtimeContext = new RuntimeContext()
  runtimeContext.set('projectId', testProjectId)

  // Format session as prompt
  const messages = testCase.session.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const prompt = `Analyze this support session for actionable feedback:

Session Title: ${testCase.session.title}
Page URL: ${testCase.session.pageUrl || 'Unknown'}

Conversation:
${messages}

Based on this conversation:
1. Determine if there's actionable feedback (bug, feature request, or change request)
2. If actionable, classify the type and assess priority
3. Either create a new issue or skip with explanation

Important: In your response, clearly state:
- The action taken (created, upvoted, or skipped)
- The issue type if applicable (bug, feature_request, change_request)
- The issue title and priority if creating
- The skip reason if skipping`

  const response = await pmAgent.generate(prompt, { runtimeContext })
  const responseText = typeof response.text === 'string' ? response.text : ''
  const parsed = parsePMAgentResponse(responseText)

  return { response: responseText, parsed }
}

describe('PM Agent Classification', () => {
  describe('Bug Classification', () => {
    const bugTestCases = getTestCasesByClassification('bug').filter(
      (tc) => !tc.expected.shouldFindExisting
    )

    it.each(bugTestCases.slice(0, 3))(
      'should classify "$name" as bug',
      async (testCase) => {
        const { parsed } = await runPMAgentOnTestCase(testCase)

        const classResult = assertClassification(parsed, testCase.expected)
        expect(classResult.passed).toBe(true)
        expect(parsed.classification).toBe('bug')
      },
      TEST_TIMEOUT
    )
  })

  describe('Feature Request Classification', () => {
    const featureTestCases = getTestCasesByClassification('feature_request').filter(
      (tc) => !tc.expected.shouldFindExisting
    )

    it.each(featureTestCases.slice(0, 2))(
      'should classify "$name" as feature request',
      async (testCase) => {
        const { parsed } = await runPMAgentOnTestCase(testCase)

        const classResult = assertClassification(parsed, testCase.expected)
        expect(classResult.passed).toBe(true)
        expect(parsed.classification).toBe('feature_request')
      },
      TEST_TIMEOUT
    )
  })

  describe('Change Request Classification', () => {
    const changeTestCases = getTestCasesByClassification('change_request').filter(
      (tc) => !tc.expected.shouldFindExisting
    )

    it.each(changeTestCases.slice(0, 2))(
      'should classify "$name" as change request',
      async (testCase) => {
        const { parsed } = await runPMAgentOnTestCase(testCase)

        const classResult = assertClassification(parsed, testCase.expected)
        expect(classResult.passed).toBe(true)
        expect(parsed.classification).toBe('change_request')
      },
      TEST_TIMEOUT
    )
  })

  describe('Skip Classification', () => {
    const skipTestCases = getTestCasesByClassification('skip')

    it.each(skipTestCases)(
      'should skip "$name"',
      async (testCase) => {
        const { parsed } = await runPMAgentOnTestCase(testCase)

        expect(parsed.action).toBe('skipped')
        expect(parsed.classification).toBe('skip')
        expect(parsed.skipReason).toBeDefined()
      },
      TEST_TIMEOUT
    )
  })
})

describe('PM Agent Duplicate Detection', () => {
  const duplicateTestCases = getDuplicateTestCases()

  it.each(duplicateTestCases)(
    'should detect duplicate for "$name"',
    async (testCase) => {
      const { parsed } = await runPMAgentOnTestCase(testCase)

      const dupResult = assertDuplicateDetection(parsed, testCase.expected)
      expect(dupResult.passed).toBe(true)

      if (testCase.expected.shouldFindExisting) {
        expect(parsed.action).toBe('upvoted')
      }
    },
    TEST_TIMEOUT
  )
})

describe('PM Agent Issue Quality', () => {
  const bugTestCases = getTestCasesByClassification('bug').filter(
    (tc) =>
      !tc.expected.shouldFindExisting &&
      tc.expected.issueTitlePattern &&
      tc.expected.priority
  )

  it.each(bugTestCases.slice(0, 2))(
    'should create quality issue for "$name"',
    async (testCase) => {
      const { parsed } = await runPMAgentOnTestCase(testCase)

      // Check title pattern
      const titleResult = assertTitlePattern(parsed, testCase.expected)
      expect(titleResult.passed).toBe(true)

      // Check priority
      const priorityResult = assertPriority(parsed, testCase.expected)
      expect(priorityResult.passed).toBe(true)

      // Should have a title
      expect(parsed.issueTitle).toBeDefined()
      expect(parsed.issueTitle!.length).toBeGreaterThan(10)
    },
    TEST_TIMEOUT
  )
})

describe('PM Agent Edge Cases', () => {
  const edgeCases = getEdgeCases()

  it.each(edgeCases)(
    'should handle edge case "$name"',
    async (testCase) => {
      const { parsed } = await runPMAgentOnTestCase(testCase)

      // Edge cases may have flexible expected outcomes
      // Just verify the agent made a decision
      expect(parsed.action).toBeDefined()
      expect(['created', 'upvoted', 'skipped']).toContain(parsed.action)

      if (parsed.action !== 'skipped') {
        expect(parsed.classification).toBeDefined()
        expect(['bug', 'feature_request', 'change_request']).toContain(
          parsed.classification
        )
      }
    },
    TEST_TIMEOUT
  )
})

describe('PM Agent Response Structure', () => {
  it(
    'should provide actionable response with clear structure',
    async () => {
      // Use first bug test case
      const testCase = getTestCasesByClassification('bug')[0]
      const { response, parsed } = await runPMAgentOnTestCase(testCase)

      // Response should not be empty
      expect(response.length).toBeGreaterThan(100)

      // Response should mention the action
      const responseLower = response.toLowerCase()
      expect(
        responseLower.includes('created') ||
          responseLower.includes('upvoted') ||
          responseLower.includes('skipped') ||
          responseLower.includes('skip')
      ).toBe(true)

      // For created issues, should have classification
      if (parsed.action === 'created') {
        expect(
          responseLower.includes('bug') ||
            responseLower.includes('feature') ||
            responseLower.includes('change')
        ).toBe(true)
      }
    },
    TEST_TIMEOUT
  )

  it(
    'should handle empty/minimal sessions gracefully',
    async () => {
      const minimalTestCase: PMEvalTestCase = {
        id: 'test-minimal',
        name: 'Minimal session',
        description: 'Test with minimal content',
        session: {
          title: 'Hi',
          messages: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello! How can I help?' },
          ],
        },
        expected: {
          classification: 'skip',
          shouldFindExisting: false,
        },
        tags: ['test'],
      }

      const { parsed } = await runPMAgentOnTestCase(minimalTestCase)

      // Should skip or at least not crash
      expect(parsed.action).toBeDefined()
      // Minimal sessions should typically be skipped
      expect(parsed.action).toBe('skipped')
    },
    TEST_TIMEOUT
  )
})

describe('PM Agent Dataset Validation', () => {
  it('should have valid test cases in the dataset', () => {
    // Verify dataset structure
    expect(pmEvalDataset.testCases.length).toBeGreaterThan(15)
    expect(pmEvalDataset.seedIssues.length).toBeGreaterThan(0)

    // Verify each test case has required fields
    for (const testCase of pmEvalDataset.testCases) {
      expect(testCase.id).toBeDefined()
      expect(testCase.name).toBeDefined()
      expect(testCase.session.messages.length).toBeGreaterThan(0)
      expect(testCase.expected.classification).toBeDefined()
      expect(testCase.tags.length).toBeGreaterThan(0)
    }
  })

  it('should have test cases for all classification types', () => {
    const bugs = getTestCasesByClassification('bug')
    const features = getTestCasesByClassification('feature_request')
    const changes = getTestCasesByClassification('change_request')
    const skips = getTestCasesByClassification('skip')

    expect(bugs.length).toBeGreaterThan(0)
    expect(features.length).toBeGreaterThan(0)
    expect(changes.length).toBeGreaterThan(0)
    expect(skips.length).toBeGreaterThan(0)
  })

  it('should have duplicate detection test cases', () => {
    const duplicates = getDuplicateTestCases()
    expect(duplicates.length).toBeGreaterThan(0)

    // Each duplicate should reference a seed issue
    for (const dup of duplicates) {
      expect(dup.expected.shouldFindExisting).toBe(true)
      // Some duplicates should specify the expected issue ID
      if (dup.expected.existingIssueId) {
        const seedIssue = pmEvalDataset.seedIssues.find(
          (s) => s.id === dup.expected.existingIssueId
        )
        expect(seedIssue).toBeDefined()
      }
    }
  })
})
