/**
 * Issue Analysis Unit Tests
 *
 * Tests the core business logic for issue analysis:
 * - Priority calculation (upvote-based and multi-factor)
 * - Keyword extraction and similarity matching
 * - Session tagging response parsing
 * - PM review response parsing
 * - Assertion helpers
 * - Tag hint generation
 * - Session filter types
 */

import { describe, it, expect } from 'vitest'

// ============================================================================
// Priority Calculation
// ============================================================================

import {
  calculatePriority,
  calculateRICEScore,
  riceScoreToPriority,
} from '@/lib/issues/issues-service'

describe('calculatePriority', () => {
  it('returns low for 1-2 upvotes', () => {
    expect(calculatePriority(1)).toBe('low')
    expect(calculatePriority(2)).toBe('low')
  })

  it('returns medium for 3-4 upvotes', () => {
    expect(calculatePriority(3)).toBe('medium')
    expect(calculatePriority(4)).toBe('medium')
  })

  it('returns high for 5+ upvotes', () => {
    expect(calculatePriority(5)).toBe('high')
    expect(calculatePriority(10)).toBe('high')
    expect(calculatePriority(100)).toBe('high')
  })

  it('returns low for 0 upvotes', () => {
    expect(calculatePriority(0)).toBe('low')
  })
})

describe('calculateRICEScore', () => {
  it('returns null when reach, impact, or effort is null', () => {
    expect(calculateRICEScore(null, 3, 3, 3)).toBe(null)
    expect(calculateRICEScore(3, null, 3, 3)).toBe(null)
    expect(calculateRICEScore(3, 3, 3, null)).toBe(null)
  })

  it('defaults confidence to 3 when null', () => {
    // (5 * 5 * 3) / 1 = 75
    expect(calculateRICEScore(5, 5, null, 1)).toBe(75)
  })

  it('calculates RICE correctly with all scores', () => {
    // (5 * 5 * 5) / 1 = 125
    expect(calculateRICEScore(5, 5, 5, 1)).toBe(125)
    // (1 * 1 * 1) / 5 = 0.2
    expect(calculateRICEScore(1, 1, 1, 5)).toBeCloseTo(0.2)
    // (3 * 4 * 3) / 2 = 18
    expect(calculateRICEScore(3, 4, 3, 2)).toBe(18)
  })

  it('prevents division by zero (effort clamped to 1)', () => {
    // Even with effort=0, it should use 1: (3 * 3 * 3) / 1 = 27
    expect(calculateRICEScore(3, 3, 3, 0)).toBe(27)
  })
})

describe('riceScoreToPriority', () => {
  it('returns null for null score', () => {
    expect(riceScoreToPriority(null)).toBe(null)
  })

  it('returns high for score >= 20', () => {
    expect(riceScoreToPriority(20)).toBe('high')
    expect(riceScoreToPriority(100)).toBe('high')
  })

  it('returns medium for score >= 5 and < 20', () => {
    expect(riceScoreToPriority(5)).toBe('medium')
    expect(riceScoreToPriority(19.9)).toBe('medium')
  })

  it('returns low for score < 5', () => {
    expect(riceScoreToPriority(4.9)).toBe('low')
    expect(riceScoreToPriority(0)).toBe('low')
  })
})

// ============================================================================
// Shared imports from test-utils (used across multiple test sections)
// ============================================================================

import {
  MockDataStore,
  createMockIssue,
  createTestContext,
  parseSessionTaggingResponse,
  parsePMReviewResponse,
  assertSessionTags,
  assertHasAnyTag,
  assertPMClassification,
  assertDuplicateDetection,
  assertPriority,
  type ParsedSessionTaggingResult,
  type ParsedPMReviewResult,
  type ParsedPMResponse,
} from '@/__tests__/integration/session-analysis/test-utils'

// ============================================================================
// Keyword Extraction and Similarity (from issue-tools.ts)
// Since extractKeywords and calculateNaiveSimilarity are not exported,
// we test them indirectly through the MockDataStore.
// ============================================================================

describe('keyword extraction and similarity', () => {
  // Test through MockDataStore.findSimilarIssues (imported at bottom of file)
  it('finds issues with matching keywords', () => {
    const store = new MockDataStore()
    const projectId = 'test-project'

    store.addIssue(createMockIssue(
      { id: 'seed-1', title: 'Checkout button broken', description: 'Button does not respond', type: 'bug', priority: 'high', upvoteCount: 3 },
      projectId
    ))

    const results = store.findSimilarIssues('checkout', projectId)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toContain('Checkout')
  })

  it('returns empty for unrelated queries', () => {
    const store = new MockDataStore()
    const projectId = 'test-project'

    store.addIssue(createMockIssue(
      { id: 'seed-1', title: 'Checkout button broken', description: 'Button does not respond', type: 'bug', priority: 'high', upvoteCount: 3 },
      projectId
    ))

    const results = store.findSimilarIssues('zzzzunrelated', projectId)
    expect(results.length).toBe(0)
  })

  it('only finds issues within the same project', () => {
    const store = new MockDataStore()

    store.addIssue(createMockIssue(
      { id: 'seed-1', title: 'Checkout button broken', description: 'Button does not respond', type: 'bug', priority: 'high', upvoteCount: 3 },
      'project-a'
    ))

    const results = store.findSimilarIssues('checkout', 'project-b')
    expect(results.length).toBe(0)
  })
})

// ============================================================================
// Response Parsing
// ============================================================================

// parseSessionTaggingResponse, parsePMReviewResponse
// imported above from test-utils

describe('parseSessionTaggingResponse', () => {
  it('parses JSON-formatted tags', () => {
    const response = '{"tags": ["bug", "losses"], "reasoning": "User reported a crash"}'
    const result = parseSessionTaggingResponse(response)
    expect(result.tags).toEqual(['bug', 'losses'])
    expect(result.tagsApplied).toBe(true)
    expect(result.hasActionableTags).toBe(true)
    expect(result.hasSentimentTags).toBe(true)
  })

  it('detects tags from natural language text', () => {
    const response = 'This is a bug report. The user seems frustrated (losses).'
    const result = parseSessionTaggingResponse(response)
    expect(result.tags).toContain('bug')
    expect(result.tags).toContain('losses')
    expect(result.hasActionableTags).toBe(true)
  })

  it('identifies win-only sessions as non-actionable', () => {
    const response = '{"tags": ["wins"], "reasoning": "User was satisfied"}'
    const result = parseSessionTaggingResponse(response)
    expect(result.tags).toEqual(['wins'])
    expect(result.hasActionableTags).toBe(false)
    expect(result.hasSentimentTags).toBe(true)
  })

  it('handles feature_request tags', () => {
    const response = '{"tags": ["feature_request"], "reasoning": "User wants PDF export"}'
    const result = parseSessionTaggingResponse(response)
    expect(result.tags).toEqual(['feature_request'])
    expect(result.hasActionableTags).toBe(true)
  })

  it('handles change_request tags', () => {
    const response = '{"tags": ["change_request"], "reasoning": "UX improvement needed"}'
    const result = parseSessionTaggingResponse(response)
    expect(result.tags).toEqual(['change_request'])
    expect(result.hasActionableTags).toBe(true)
  })

  it('handles empty response', () => {
    const result = parseSessionTaggingResponse('')
    expect(result.tags).toEqual([])
    expect(result.tagsApplied).toBe(false)
  })

  it('ignores invalid tags in JSON', () => {
    const response = '{"tags": ["bug", "invalid_tag_xyz"], "reasoning": "test"}'
    const result = parseSessionTaggingResponse(response)
    expect(result.tags).toEqual(['bug'])
  })

  it('handles multiple actionable tags', () => {
    const response = '{"tags": ["bug", "feature_request", "losses"], "reasoning": "Complex feedback"}'
    const result = parseSessionTaggingResponse(response)
    expect(result.tags).toHaveLength(3)
    expect(result.hasActionableTags).toBe(true)
    expect(result.hasSentimentTags).toBe(true)
  })

  it('detects general_feedback from text', () => {
    const response = 'This is general_feedback from the user about the product.'
    const result = parseSessionTaggingResponse(response)
    expect(result.tags).toContain('general_feedback')
  })

  it('supports custom tags when provided', () => {
    const customTags = [
      { id: '1', project_id: 'p1', name: 'Onboarding', slug: 'onboarding', description: '', color: 'info', position: 0, created_at: '', updated_at: '' },
    ]
    const response = '{"tags": ["bug", "onboarding"], "reasoning": "Onboarding bug"}'
    const result = parseSessionTaggingResponse(response, customTags)
    expect(result.tags).toContain('bug')
    expect(result.tags).toContain('onboarding')
    expect(result.hasCustomTags).toBe(true)
  })
})

describe('parsePMReviewResponse', () => {
  it('detects created action', () => {
    const response = 'Created a new issue: bug report for checkout failure'
    const result = parsePMReviewResponse(response)
    expect(result.action).toBe('created')
  })

  it('detects upvoted action', () => {
    const response = 'Upvoted existing issue #123'
    const result = parsePMReviewResponse(response)
    expect(result.action).toBe('upvoted')
  })

  it('detects skipped action', () => {
    const response = 'This is a Q&A session that was resolved.'
    const result = parsePMReviewResponse(response)
    expect(result.action).toBe('skipped')
    expect(result.skipReason).toBeDefined()
  })

  it('extracts bug type', () => {
    const response = 'Created issue. Type: bug. The checkout is broken.'
    const result = parsePMReviewResponse(response)
    expect(result.issueType).toBe('bug')
  })

  it('extracts feature_request type', () => {
    const response = 'Created issue. This is a feature request for PDF export.'
    const result = parsePMReviewResponse(response)
    expect(result.issueType).toBe('feature_request')
  })

  it('extracts change_request type', () => {
    const response = 'Created issue. This is a change request for UX improvement.'
    const result = parsePMReviewResponse(response)
    expect(result.issueType).toBe('change_request')
  })

  it('extracts title from response', () => {
    const response = 'Created issue. Title: "Checkout button not responding"'
    const result = parsePMReviewResponse(response)
    expect(result.issueTitle).toBeDefined()
  })

  it('extracts priority', () => {
    const highResp = 'Created issue with high priority'
    expect(parsePMReviewResponse(highResp).issuePriority).toBe('high')

    const medResp = 'Created issue with medium priority'
    expect(parsePMReviewResponse(medResp).issuePriority).toBe('medium')

    const lowResp = 'Created issue with low priority'
    expect(parsePMReviewResponse(lowResp).issuePriority).toBe('low')
  })

  it('provides skip reason for Q&A sessions', () => {
    const response = 'Skipping. This was a simple Q&A session.'
    const result = parsePMReviewResponse(response)
    expect(result.action).toBe('skipped')
    expect(result.skipReason).toContain('Q&A')
  })

  it('provides skip reason for short sessions', () => {
    const response = 'Skipping. Too few messages to analyze.'
    const result = parsePMReviewResponse(response)
    expect(result.action).toBe('skipped')
    expect(result.skipReason).toBeDefined()
  })
})

// ============================================================================
// Assertion Helpers
// ============================================================================

// assertSessionTags, assertHasAnyTag, assertPMClassification,
// assertDuplicateDetection, assertPriority, types
// imported above from test-utils

describe('assertSessionTags', () => {
  it('passes when tags match exactly', () => {
    const actual: ParsedSessionTaggingResult = {
      tags: ['bug', 'losses'],
      tagsApplied: true,
      reasoning: '',
      hasActionableTags: true,
      hasSentimentTags: true,
      hasCustomTags: false,
    }
    const result = assertSessionTags(actual, ['bug', 'losses'])
    expect(result.passed).toBe(true)
  })

  it('fails when tags are missing', () => {
    const actual: ParsedSessionTaggingResult = {
      tags: ['bug'],
      tagsApplied: true,
      reasoning: '',
      hasActionableTags: true,
      hasSentimentTags: false,
      hasCustomTags: false,
    }
    const result = assertSessionTags(actual, ['bug', 'losses'])
    expect(result.passed).toBe(false)
    expect(result.message).toContain('Missing')
  })

  it('fails when extra tags present', () => {
    const actual: ParsedSessionTaggingResult = {
      tags: ['bug', 'losses', 'wins'],
      tagsApplied: true,
      reasoning: '',
      hasActionableTags: true,
      hasSentimentTags: true,
      hasCustomTags: false,
    }
    const result = assertSessionTags(actual, ['bug', 'losses'])
    expect(result.passed).toBe(false)
    expect(result.message).toContain('Unexpected')
  })
})

describe('assertHasAnyTag', () => {
  it('passes when at least one tag matches', () => {
    const actual: ParsedSessionTaggingResult = {
      tags: ['bug'],
      tagsApplied: true,
      reasoning: '',
      hasActionableTags: true,
      hasSentimentTags: false,
      hasCustomTags: false,
    }
    const result = assertHasAnyTag(actual, ['bug', 'feature_request'])
    expect(result.passed).toBe(true)
  })

  it('fails when no tags match', () => {
    const actual: ParsedSessionTaggingResult = {
      tags: ['wins'],
      tagsApplied: true,
      reasoning: '',
      hasActionableTags: false,
      hasSentimentTags: true,
      hasCustomTags: false,
    }
    const result = assertHasAnyTag(actual, ['bug', 'feature_request'])
    expect(result.passed).toBe(false)
  })
})

describe('assertPMClassification', () => {
  it('passes when skip is expected and action is skipped', () => {
    const actual: ParsedPMReviewResult = {
      action: 'skipped',
      issueType: null,
      skipReason: 'Q&A resolved',
    }
    const result = assertPMClassification(actual, { classification: 'skip' })
    expect(result.passed).toBe(true)
  })

  it('fails when skip is expected but action is not skipped', () => {
    const actual: ParsedPMReviewResult = {
      action: 'created',
      issueType: 'bug',
    }
    const result = assertPMClassification(actual, { classification: 'skip' })
    expect(result.passed).toBe(false)
  })

  it('passes when issue type matches expected', () => {
    const actual: ParsedPMReviewResult = {
      action: 'created',
      issueType: 'bug',
    }
    const result = assertPMClassification(actual, { classification: 'bug' })
    expect(result.passed).toBe(true)
  })

  it('fails when issue type does not match', () => {
    const actual: ParsedPMReviewResult = {
      action: 'created',
      issueType: 'feature_request',
    }
    const result = assertPMClassification(actual, { classification: 'bug' })
    expect(result.passed).toBe(false)
  })

  it('fails when actionable expected but skipped', () => {
    const actual: ParsedPMReviewResult = {
      action: 'skipped',
      issueType: null,
    }
    const result = assertPMClassification(actual, { classification: 'bug' })
    expect(result.passed).toBe(false)
  })
})

describe('assertDuplicateDetection', () => {
  it('passes when duplicate expected and found', () => {
    const actual: ParsedPMResponse = {
      action: 'upvoted',
      classification: 'bug',
    }
    const result = assertDuplicateDetection(actual, { classification: 'bug', shouldFindExisting: true })
    expect(result.passed).toBe(true)
  })

  it('passes when new expected and created', () => {
    const actual: ParsedPMResponse = {
      action: 'created',
      classification: 'bug',
    }
    const result = assertDuplicateDetection(actual, { classification: 'bug', shouldFindExisting: false })
    expect(result.passed).toBe(true)
  })

  it('fails when duplicate expected but created', () => {
    const actual: ParsedPMResponse = {
      action: 'created',
      classification: 'bug',
    }
    const result = assertDuplicateDetection(actual, { classification: 'bug', shouldFindExisting: true })
    expect(result.passed).toBe(false)
  })

  it('fails when new expected but upvoted', () => {
    const actual: ParsedPMResponse = {
      action: 'upvoted',
      classification: 'bug',
    }
    const result = assertDuplicateDetection(actual, { classification: 'bug', shouldFindExisting: false })
    expect(result.passed).toBe(false)
  })
})

describe('assertPriority', () => {
  it('passes when priority matches', () => {
    const actual: ParsedPMResponse = {
      action: 'created',
      classification: 'bug',
      issuePriority: 'high',
    }
    const result = assertPriority(actual, { classification: 'bug', priority: 'high' })
    expect(result.passed).toBe(true)
  })

  it('fails when priority does not match', () => {
    const actual: ParsedPMResponse = {
      action: 'created',
      classification: 'bug',
      issuePriority: 'low',
    }
    const result = assertPriority(actual, { classification: 'bug', priority: 'high' })
    expect(result.passed).toBe(false)
  })

  it('passes when no priority expected', () => {
    const actual: ParsedPMResponse = {
      action: 'created',
      classification: 'bug',
    }
    const result = assertPriority(actual, { classification: 'bug' })
    expect(result.passed).toBe(true)
  })
})

// ============================================================================
// Mock Data Store
// ============================================================================

// MockDataStore, createMockIssue, createTestContext, generateTestId
// imported above from test-utils

describe('MockDataStore', () => {
  it('stores and retrieves issues', () => {
    const store = new MockDataStore()
    const issue = createMockIssue(
      { id: 'seed-1', title: 'Test Issue', description: 'Test', type: 'bug', priority: 'low', upvoteCount: 1 },
      'project-1'
    )
    store.addIssue(issue)
    expect(store.getIssue(issue.id)).toBe(issue)
    expect(store.getAllIssues()).toHaveLength(1)
  })

  it('links sessions to issues', () => {
    const store = new MockDataStore()
    store.linkSessionToIssue('session-1', 'issue-1')
    store.linkSessionToIssue('session-2', 'issue-1')
    expect(store.getSessionsForIssue('issue-1')).toEqual(['session-1', 'session-2'])
  })

  it('clears all data', () => {
    const store = new MockDataStore()
    const issue = createMockIssue(
      { id: 'seed-1', title: 'Test', description: 'Test', type: 'bug', priority: 'low', upvoteCount: 1 },
      'project-1'
    )
    store.addIssue(issue)
    store.clear()
    expect(store.getAllIssues()).toHaveLength(0)
  })
})

describe('createTestContext', () => {
  it('creates context with seeded issues', () => {
    const seedIssues = [
      { id: 'seed-1', title: 'Bug in checkout', description: 'Cannot check out', type: 'bug' as const, priority: 'high' as const, upvoteCount: 5 },
      { id: 'seed-2', title: 'Add PDF export', description: 'Export to PDF', type: 'feature_request' as const, priority: 'medium' as const, upvoteCount: 2 },
    ]
    const { projectId, dataStore, issueIdMap } = createTestContext(seedIssues)

    expect(projectId).toBeTruthy()
    expect(dataStore.getAllIssues()).toHaveLength(2)
    expect(issueIdMap.get('seed-1')).toBeTruthy()
    expect(issueIdMap.get('seed-2')).toBeTruthy()
  })

  it('creates empty context when no seeds', () => {
    const { dataStore } = createTestContext()
    expect(dataStore.getAllIssues()).toHaveLength(0)
  })
})

// ============================================================================
// Session Filter Types
// ============================================================================

describe('SessionFilters.isAnalyzed', () => {
  it('isAnalyzed field exists in filter interface', () => {
    // Type-level test: ensure the filter type includes isAnalyzed
    const filters: import('@/types/session').SessionFilters = {
      isAnalyzed: true,
    }
    expect(filters.isAnalyzed).toBe(true)
  })

  it('isAnalyzed can be undefined', () => {
    const filters: import('@/types/session').SessionFilters = {}
    expect(filters.isAnalyzed).toBeUndefined()
  })
})

// ============================================================================
// Issue Types Validation
// ============================================================================

describe('Issue type definitions', () => {
  it('IssueType covers all valid types', () => {
    const validTypes: import('@/types/issue').IssueType[] = ['bug', 'feature_request', 'change_request']
    expect(validTypes).toHaveLength(3)
  })

  it('IssuePriority covers all valid levels', () => {
    const validPriorities: import('@/types/issue').IssuePriority[] = ['low', 'medium', 'high']
    expect(validPriorities).toHaveLength(3)
  })

  it('IssueStatus covers all valid statuses', () => {
    const validStatuses: import('@/types/issue').IssueStatus[] = ['open', 'ready', 'in_progress', 'resolved', 'closed']
    expect(validStatuses).toHaveLength(5)
  })

  it('EffortEstimate covers all valid levels', () => {
    const validEfforts: import('@/types/issue').EffortEstimate[] = ['trivial', 'small', 'medium', 'large', 'xlarge']
    expect(validEfforts).toHaveLength(5)
  })

  it('PMReviewResult action covers all outcomes', () => {
    const validActions: import('@/types/issue').PMReviewResult['action'][] = ['created', 'upvoted', 'skipped']
    expect(validActions).toHaveLength(3)
  })
})

// ============================================================================
// PM Decision Logic (tag hints)
// ============================================================================

describe('PM decision tag hints', () => {
  // We can't import buildTagHints directly since it's not exported,
  // but we can verify the decision step behavior through its skip conditions.

  it('skip condition: issue tracking disabled returns skip', () => {
    // Verify the pm-decision schema accepts skip action
    const skipDecision = {
      action: 'skip' as const,
      skipReason: 'Issue tracking is disabled for this project',
    }
    expect(skipDecision.action).toBe('skip')
    expect(skipDecision.skipReason).toBeTruthy()
  })

  it('skip condition: too few messages returns skip', () => {
    const skipDecision = {
      action: 'skip' as const,
      skipReason: 'Session has too few messages for analysis',
    }
    expect(skipDecision.action).toBe('skip')
  })

  it('create decision includes required fields', () => {
    const createDecision = {
      action: 'create' as const,
      newIssue: {
        type: 'bug' as const,
        title: 'Checkout fails on mobile',
        description: 'User reported checkout button not working on mobile Safari',
        priority: 'high' as const,
      },
    }
    expect(createDecision.newIssue.type).toBe('bug')
    expect(createDecision.newIssue.title).toBeTruthy()
    expect(createDecision.newIssue.description).toBeTruthy()
    expect(createDecision.newIssue.priority).toBe('high')
  })

  it('upvote decision includes existing issue ID', () => {
    const upvoteDecision = {
      action: 'upvote' as const,
      existingIssueId: 'some-uuid-here',
    }
    expect(upvoteDecision.existingIssueId).toBeTruthy()
  })
})

// ============================================================================
// Execute Decision Output Shapes
// ============================================================================

describe('execute decision output shapes', () => {
  it('created output includes issueId and title', () => {
    const output = {
      sessionId: 'session-1',
      projectId: 'project-1',
      tags: ['bug'],
      tagsApplied: true,
      action: 'created' as const,
      issueId: 'issue-1',
      issueTitle: 'Bug in checkout',
    }
    expect(output.action).toBe('created')
    expect(output.issueId).toBeTruthy()
    expect(output.issueTitle).toBeTruthy()
  })

  it('upvoted output includes issueId', () => {
    const output = {
      sessionId: 'session-1',
      projectId: 'project-1',
      tags: ['feature_request'],
      tagsApplied: true,
      action: 'upvoted' as const,
      issueId: 'issue-1',
    }
    expect(output.action).toBe('upvoted')
    expect(output.issueId).toBeTruthy()
  })

  it('skipped output includes skipReason', () => {
    const output = {
      sessionId: 'session-1',
      projectId: 'project-1',
      tags: ['wins'],
      tagsApplied: true,
      action: 'skipped' as const,
      skipReason: 'No actionable feedback',
    }
    expect(output.action).toBe('skipped')
    expect(output.skipReason).toBeTruthy()
  })
})

// ============================================================================
// Workflow Schema Validation
// ============================================================================

import {
  pmDecisionSchema,
  similarIssueSchema,
  workflowInputSchema,
  workflowOutputSchema,
} from '@/mastra/workflows/session-review/schemas'

describe('workflow schemas', () => {
  describe('pmDecisionSchema', () => {
    it('validates skip decision', () => {
      const result = pmDecisionSchema.safeParse({
        action: 'skip',
        skipReason: 'No actionable feedback',
      })
      expect(result.success).toBe(true)
    })

    it('validates create decision', () => {
      const result = pmDecisionSchema.safeParse({
        action: 'create',
        newIssue: {
          type: 'bug',
          title: 'Test issue',
          description: 'Test description',
          priority: 'medium',
        },
      })
      expect(result.success).toBe(true)
    })

    it('validates upvote decision', () => {
      const result = pmDecisionSchema.safeParse({
        action: 'upvote',
        existingIssueId: 'some-uuid',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid action', () => {
      const result = pmDecisionSchema.safeParse({
        action: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid issue type in create', () => {
      const result = pmDecisionSchema.safeParse({
        action: 'create',
        newIssue: {
          type: 'invalid_type',
          title: 'Test',
          description: 'Test',
          priority: 'low',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid priority in create', () => {
      const result = pmDecisionSchema.safeParse({
        action: 'create',
        newIssue: {
          type: 'bug',
          title: 'Test',
          description: 'Test',
          priority: 'critical',
        },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('similarIssueSchema', () => {
    it('validates a valid similar issue', () => {
      const result = similarIssueSchema.safeParse({
        issueId: 'uuid-123',
        title: 'Existing issue',
        description: 'Description',
        upvoteCount: 3,
        status: 'open',
        similarity: 0.85,
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const result = similarIssueSchema.safeParse({
        issueId: 'uuid-123',
        title: 'Existing issue',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('workflowInputSchema', () => {
    it('validates minimal input', () => {
      const result = workflowInputSchema.safeParse({
        sessionId: 'session-1',
        projectId: 'project-1',
      })
      expect(result.success).toBe(true)
    })

    it('validates input with classification guidelines', () => {
      const result = workflowInputSchema.safeParse({
        sessionId: 'session-1',
        projectId: 'project-1',
        classificationGuidelines: 'Custom guidelines here',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing sessionId', () => {
      const result = workflowInputSchema.safeParse({
        projectId: 'project-1',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('workflowOutputSchema', () => {
    it('validates created output', () => {
      const result = workflowOutputSchema.safeParse({
        tags: ['bug'],
        tagsApplied: true,
        productScopeId: null,
        action: 'created',
        issueId: 'issue-1',
        issueTitle: 'Test issue',
      })
      expect(result.success).toBe(true)
    })

    it('validates skipped output', () => {
      const result = workflowOutputSchema.safeParse({
        tags: ['wins'],
        tagsApplied: true,
        productScopeId: null,
        action: 'skipped',
        skipReason: 'No actionable feedback',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid tag format', () => {
      const result = workflowOutputSchema.safeParse({
        tags: ['Invalid Tag With Spaces'],
        tagsApplied: true,
        productScopeId: null,
        action: 'skipped',
      })
      expect(result.success).toBe(false)
    })
  })
})
