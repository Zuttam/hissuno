/**
 * PM Agent Test Utilities Unit Tests
 *
 * Tests the parsing and assertion logic used in integration tests.
 */

import { describe, it, expect } from 'vitest'
import {
  parsePMAgentResponse,
  assertClassification,
  assertDuplicateDetection,
  assertTitlePattern,
  assertPriority,
  generateTestId,
  MockDataStore,
} from '../integration/session-analysis/test-utils'
import type { PMEvalTestCase } from '@/evals/datasets/types'

describe('PM Agent Response Parser', () => {
  describe('Action Detection', () => {
    it('should detect "created" action', () => {
      const response = 'I have created a new issue titled "Bug Report"'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.action).toBe('created')
    })

    it('should detect "upvoted" action', () => {
      const response = 'I found a similar issue and upvoted it'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.action).toBe('upvoted')
    })

    it('should detect "skipped" action by default', () => {
      const response = 'This session does not contain actionable feedback. Skipping.'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.action).toBe('skipped')
    })
  })

  describe('Classification Detection', () => {
    it('should detect bug classification', () => {
      const response = 'This is a bug report. Creating issue: "App crashes on startup"'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.classification).toBe('bug')
    })

    it('should detect feature request classification', () => {
      const response = 'This is a feature request. Creating issue: "Add dark mode"'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.classification).toBe('feature_request')
    })

    it('should detect change request classification', () => {
      const response = 'This is a change request. Creating issue: "Move button to footer"'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.classification).toBe('change_request')
    })

    it('should return skip for skipped sessions', () => {
      const response = 'Skipping this session as it is a simple Q&A'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.classification).toBe('skip')
    })
  })

  describe('Priority Detection', () => {
    it('should detect high priority', () => {
      const response = 'Creating issue with high priority: "Critical bug"'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.issuePriority).toBe('high')
    })

    it('should detect medium priority', () => {
      const response = 'Creating issue with medium priority: "Minor issue"'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.issuePriority).toBe('medium')
    })

    it('should detect low priority', () => {
      const response = 'Creating issue with low priority: "Nice to have"'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.issuePriority).toBe('low')
    })
  })

  describe('Skip Reason Detection', () => {
    it('should detect Q&A skip reason from keyword', () => {
      const response = 'Skip: This is a question and answer session with no actionable feedback.'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.skipReason).toBeDefined()
      expect(parsed.action).toBe('skipped')
    })

    it('should detect off-topic skip reason from keyword', () => {
      const response = 'Skip: This conversation is off-topic and irrelevant.'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.skipReason).toBeDefined()
      expect(parsed.action).toBe('skipped')
    })

    it('should provide default skip reason', () => {
      const response = 'Skipping this session.'
      const parsed = parsePMAgentResponse(response)
      expect(parsed.skipReason).toBeDefined()
    })
  })
})

describe('Assertion Helpers', () => {
  const createTestCase = (overrides: Partial<PMEvalTestCase['expected']>): PMEvalTestCase => ({
    id: 'test-case',
    name: 'Test Case',
    description: 'A test case',
    session: {
      title: 'Test',
      messages: [{ role: 'user', content: 'Hello' }],
    },
    expected: {
      classification: 'bug',
      shouldFindExisting: false,
      ...overrides,
    },
    tags: ['test'],
  })

  describe('assertClassification', () => {
    it('should pass for matching classification', () => {
      const parsed = { action: 'created' as const, classification: 'bug' as const, rawResponse: '' }
      const testCase = createTestCase({ classification: 'bug' })
      const result = assertClassification(parsed, testCase.expected)
      expect(result.passed).toBe(true)
    })

    it('should fail for mismatched classification', () => {
      const parsed = { action: 'created' as const, classification: 'feature_request' as const, rawResponse: '' }
      const testCase = createTestCase({ classification: 'bug' })
      const result = assertClassification(parsed, testCase.expected)
      expect(result.passed).toBe(false)
    })
  })

  describe('assertDuplicateDetection', () => {
    it('should pass when duplicate correctly found', () => {
      const parsed = { action: 'upvoted' as const, classification: 'bug' as const, rawResponse: '' }
      const testCase = createTestCase({ shouldFindExisting: true })
      const result = assertDuplicateDetection(parsed, testCase.expected)
      expect(result.passed).toBe(true)
    })

    it('should fail when duplicate missed', () => {
      const parsed = { action: 'created' as const, classification: 'bug' as const, rawResponse: '' }
      const testCase = createTestCase({ shouldFindExisting: true })
      const result = assertDuplicateDetection(parsed, testCase.expected)
      expect(result.passed).toBe(false)
    })

    it('should pass when correctly identified as new', () => {
      const parsed = { action: 'created' as const, classification: 'bug' as const, rawResponse: '' }
      const testCase = createTestCase({ shouldFindExisting: false })
      const result = assertDuplicateDetection(parsed, testCase.expected)
      expect(result.passed).toBe(true)
    })
  })

  describe('assertTitlePattern', () => {
    it('should pass when title matches pattern', () => {
      const parsed = { action: 'created' as const, classification: 'bug' as const, rawResponse: '', issueTitle: 'App crashes on image upload' }
      const testCase = createTestCase({ issueTitlePattern: 'crash|upload' })
      const result = assertTitlePattern(parsed, testCase.expected)
      expect(result.passed).toBe(true)
    })

    it('should fail when title does not match pattern', () => {
      const parsed = { action: 'created' as const, classification: 'bug' as const, rawResponse: '', issueTitle: 'Button is blue' }
      const testCase = createTestCase({ issueTitlePattern: 'crash|upload' })
      const result = assertTitlePattern(parsed, testCase.expected)
      expect(result.passed).toBe(false)
    })

    it('should pass when no pattern specified', () => {
      const parsed = { action: 'created' as const, classification: 'bug' as const, rawResponse: '', issueTitle: 'Any title' }
      const testCase = createTestCase({})
      const result = assertTitlePattern(parsed, testCase.expected)
      expect(result.passed).toBe(true)
    })
  })

  describe('assertPriority', () => {
    it('should pass when priority matches', () => {
      const parsed = { action: 'created' as const, classification: 'bug' as const, rawResponse: '', issuePriority: 'high' as const }
      const testCase = createTestCase({ priority: 'high' })
      const result = assertPriority(parsed, testCase.expected)
      expect(result.passed).toBe(true)
    })

    it('should fail when priority does not match', () => {
      const parsed = { action: 'created' as const, classification: 'bug' as const, rawResponse: '', issuePriority: 'low' as const }
      const testCase = createTestCase({ priority: 'high' })
      const result = assertPriority(parsed, testCase.expected)
      expect(result.passed).toBe(false)
    })

    it('should pass when no priority expected', () => {
      const parsed = { action: 'created' as const, classification: 'bug' as const, rawResponse: '', issuePriority: 'medium' as const }
      const testCase = createTestCase({})
      const result = assertPriority(parsed, testCase.expected)
      expect(result.passed).toBe(true)
    })
  })
})

describe('Utility Functions', () => {
  describe('generateTestId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateTestId('test')
      const id2 = generateTestId('test')
      expect(id1).not.toBe(id2)
    })

    it('should include prefix', () => {
      const id = generateTestId('session')
      expect(id.startsWith('session-')).toBe(true)
    })
  })

  describe('MockDataStore', () => {
    it('should store and retrieve issues', () => {
      const store = new MockDataStore()
      const issue = {
        id: 'issue-1',
        project_id: 'project-1',
        type: 'bug' as const,
        title: 'Test Issue',
        description: 'A test issue',
        priority: 'high' as const,
        priority_manual_override: false,
        upvote_count: 0,
        status: 'open' as const,
        product_spec: null,
        product_spec_generated_at: null,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        affected_areas: [],
        impact_score: null,
        impact_analysis: null,
        effort_estimate: null,
        effort_reasoning: null,
        affected_files: [],
      }

      store.addIssue(issue)
      expect(store.getIssue('issue-1')).toEqual(issue)
    })

    it('should find similar issues', () => {
      const store = new MockDataStore()
      const issue = {
        id: 'issue-1',
        project_id: 'project-1',
        type: 'bug' as const,
        title: 'Checkout button broken on Safari',
        description: 'Users report checkout issues',
        priority: 'high' as const,
        priority_manual_override: false,
        upvote_count: 0,
        status: 'open' as const,
        product_spec: null,
        product_spec_generated_at: null,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        affected_areas: [],
        impact_score: null,
        impact_analysis: null,
        effort_estimate: null,
        effort_reasoning: null,
        affected_files: [],
      }

      store.addIssue(issue)
      const similar = store.findSimilarIssues('checkout', 'project-1')
      expect(similar.length).toBe(1)
      expect(similar[0].id).toBe('issue-1')
    })

    it('should clear all data', () => {
      const store = new MockDataStore()
      store.addIssue({
        id: 'issue-1',
        project_id: 'project-1',
        type: 'bug' as const,
        title: 'Test',
        description: 'Test',
        priority: 'low' as const,
        priority_manual_override: false,
        upvote_count: 0,
        status: 'open' as const,
        product_spec: null,
        product_spec_generated_at: null,
        is_archived: false,
        affected_areas: [],
        impact_score: null,
        impact_analysis: null,
        effort_estimate: null,
        effort_reasoning: null,
        affected_files: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      store.clear()
      expect(store.getAllIssues().length).toBe(0)
    })
  })
})
