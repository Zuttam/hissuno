/**
 * PM Agent Dataset Unit Tests
 *
 * These tests validate the structure and content of the evaluation dataset
 * without requiring database or API connections.
 */

import { describe, it, expect } from 'vitest'
import {
  pmEvalDataset,
  getTestCasesByClassification,
  getDuplicateTestCases,
  getEdgeCases,
  getTestCasesByTag,
  datasetStats,
} from '@/evals/datasets/pm-agent-dataset'

describe('PM Agent Evaluation Dataset', () => {
  describe('Dataset Structure', () => {
    it('should have valid metadata', () => {
      expect(pmEvalDataset.version).toBeDefined()
      expect(pmEvalDataset.description).toBeDefined()
      expect(pmEvalDataset.testCases).toBeInstanceOf(Array)
      expect(pmEvalDataset.seedIssues).toBeInstanceOf(Array)
    })

    it('should have sufficient test cases', () => {
      expect(pmEvalDataset.testCases.length).toBeGreaterThanOrEqual(15)
    })

    it('should have seed issues for duplicate detection', () => {
      expect(pmEvalDataset.seedIssues.length).toBeGreaterThan(0)
    })
  })

  describe('Test Case Validation', () => {
    it('should have required fields for all test cases', () => {
      for (const testCase of pmEvalDataset.testCases) {
        expect(testCase.id).toBeDefined()
        expect(typeof testCase.id).toBe('string')
        expect(testCase.id.length).toBeGreaterThan(0)

        expect(testCase.name).toBeDefined()
        expect(typeof testCase.name).toBe('string')

        expect(testCase.description).toBeDefined()
        expect(typeof testCase.description).toBe('string')

        expect(testCase.session).toBeDefined()
        expect(testCase.session.title).toBeDefined()
        expect(testCase.session.messages).toBeInstanceOf(Array)
        expect(testCase.session.messages.length).toBeGreaterThan(0)

        expect(testCase.expected).toBeDefined()
        expect(testCase.expected.classification).toBeDefined()
        expect(['bug', 'feature_request', 'change_request', 'skip']).toContain(
          testCase.expected.classification
        )

        expect(testCase.tags).toBeInstanceOf(Array)
        expect(testCase.tags.length).toBeGreaterThan(0)
      }
    })

    it('should have valid message roles', () => {
      for (const testCase of pmEvalDataset.testCases) {
        for (const message of testCase.session.messages) {
          expect(message.role).toBeDefined()
          expect(['user', 'assistant', 'system']).toContain(message.role)
          expect(message.content).toBeDefined()
          expect(typeof message.content).toBe('string')
        }
      }
    })

    it('should have unique test case IDs', () => {
      const ids = pmEvalDataset.testCases.map((tc) => tc.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('Classification Coverage', () => {
    it('should have test cases for bug classification', () => {
      const bugs = getTestCasesByClassification('bug')
      expect(bugs.length).toBeGreaterThanOrEqual(3)
    })

    it('should have test cases for feature request classification', () => {
      const features = getTestCasesByClassification('feature_request')
      expect(features.length).toBeGreaterThanOrEqual(3)
    })

    it('should have test cases for change request classification', () => {
      const changes = getTestCasesByClassification('change_request')
      expect(changes.length).toBeGreaterThanOrEqual(2)
    })

    it('should have test cases for skip classification', () => {
      const skips = getTestCasesByClassification('skip')
      expect(skips.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Duplicate Detection Tests', () => {
    it('should have duplicate detection test cases', () => {
      const duplicates = getDuplicateTestCases()
      expect(duplicates.length).toBeGreaterThan(0)
    })

    it('should reference valid seed issues', () => {
      const duplicates = getDuplicateTestCases()
      const seedIssueIds = new Set(pmEvalDataset.seedIssues.map((s) => s.id))

      for (const dup of duplicates) {
        if (dup.expected.existingIssueId) {
          expect(seedIssueIds.has(dup.expected.existingIssueId)).toBe(true)
        }
      }
    })

    it('should have shouldFindExisting set to true for duplicate cases', () => {
      const duplicates = getDuplicateTestCases()
      for (const dup of duplicates) {
        expect(dup.expected.shouldFindExisting).toBe(true)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should have edge case test cases', () => {
      const edgeCases = getEdgeCases()
      expect(edgeCases.length).toBeGreaterThan(0)
    })

    it('should have edge-case tag for edge cases', () => {
      const edgeCases = getEdgeCases()
      for (const tc of edgeCases) {
        expect(tc.tags).toContain('edge-case')
      }
    })
  })

  describe('Seed Issues', () => {
    it('should have valid seed issue structure', () => {
      for (const seedIssue of pmEvalDataset.seedIssues) {
        expect(seedIssue.id).toBeDefined()
        expect(seedIssue.type).toBeDefined()
        expect(['bug', 'feature_request', 'change_request']).toContain(seedIssue.type)
        expect(seedIssue.name).toBeDefined()
        expect(seedIssue.description).toBeDefined()
        expect(seedIssue.priority).toBeDefined()
        expect(['low', 'medium', 'high']).toContain(seedIssue.priority)
      }
    })

    it('should have unique seed issue IDs', () => {
      const ids = pmEvalDataset.seedIssues.map((s) => s.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('Helper Functions', () => {
    it('getTestCasesByTag should return matching test cases', () => {
      const bugs = getTestCasesByTag('bug')
      expect(bugs.every((tc) => tc.tags.includes('bug'))).toBe(true)

      const features = getTestCasesByTag('feature')
      expect(features.every((tc) => tc.tags.includes('feature'))).toBe(true)
    })

    it('datasetStats should provide accurate counts', () => {
      expect(datasetStats.totalTestCases).toBe(pmEvalDataset.testCases.length)
      expect(datasetStats.seedIssues).toBe(pmEvalDataset.seedIssues.length)
      
      const bugs = getTestCasesByClassification('bug')
      expect(datasetStats.byClassification.bug).toBe(bugs.length)
    })
  })

  describe('Test Quality', () => {
    it('should have meaningful session conversations (at least 3 messages)', () => {
      const nonSkipCases = pmEvalDataset.testCases.filter(
        (tc) =>
          tc.expected.classification !== 'skip' ||
          !tc.tags.includes('short')
      )

      for (const tc of nonSkipCases) {
        if (!tc.tags.includes('short')) {
          expect(tc.session.messages.length).toBeGreaterThanOrEqual(3)
        }
      }
    })

    it('should have expected priority for actionable issues', () => {
      const actionableCases = pmEvalDataset.testCases.filter(
        (tc) =>
          tc.expected.classification !== 'skip' &&
          !tc.expected.shouldFindExisting
      )

      // At least some actionable cases should have expected priority
      const withPriority = actionableCases.filter(
        (tc) => tc.expected.priority !== undefined
      )
      expect(withPriority.length).toBeGreaterThan(0)
    })

    it('should have title patterns for new issues', () => {
      const newIssueCases = pmEvalDataset.testCases.filter(
        (tc) =>
          tc.expected.classification !== 'skip' &&
          !tc.expected.shouldFindExisting
      )

      // At least some new issue cases should have title patterns
      const withTitlePattern = newIssueCases.filter(
        (tc) => tc.expected.issueTitlePattern !== undefined
      )
      expect(withTitlePattern.length).toBeGreaterThan(0)
    })
  })
})
