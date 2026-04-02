/**
 * Tests for Goal Classification.
 * Verifies LLM goal classification, no-goals shortcut, goal ID validation,
 * and LLM failure fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProductScopeGoal } from '@/types/product-scope'

const mockGenerateObject = vi.hoisted(() => vi.fn())

vi.mock('ai', () => ({
  generateObject: mockGenerateObject,
}))
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mock-model'),
}))

import { classifyGoal, type ClassifyGoalInput } from '@/mastra/workflows/graph-evaluation/steps/classify-goal'

const GOALS: ProductScopeGoal[] = [
  { id: 'goal-1', text: 'Improve onboarding flow' },
  { id: 'goal-2', text: 'Reduce churn rate' },
  { id: 'goal-3', text: 'Increase API adoption' },
]

function makeInput(overrides: Partial<ClassifyGoalInput> = {}): ClassifyGoalInput {
  return {
    entityName: 'Login Bug',
    contentSnippet: 'Users report that the login page freezes after entering credentials.',
    scopeName: 'Core Platform',
    scopeDescription: 'Core platform features and infrastructure',
    goals: GOALS,
    matchedTopic: 'login',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('classifyGoal', () => {
  describe('no goals defined', () => {
    it('returns null goalId and goalText when goals array is empty', async () => {
      const result = await classifyGoal(makeInput({ goals: [] }))
      expect(result.matchedGoalId).toBeNull()
      expect(result.matchedGoalText).toBeNull()
    })

    it('does NOT call generateObject when goals are empty', async () => {
      await classifyGoal(makeInput({ goals: [] }))
      expect(mockGenerateObject).not.toHaveBeenCalled()
    })

    it('returns "Matched via topic" reasoning when matchedTopic is provided', async () => {
      const result = await classifyGoal(makeInput({ goals: [], matchedTopic: 'billing' }))
      expect(result.reasoning).toBe('Matched via topic: billing')
    })

    it('returns scope-based reasoning when matchedTopic is undefined', async () => {
      const result = await classifyGoal(makeInput({ goals: [], matchedTopic: undefined }))
      expect(result.reasoning).toBe('Matched to scope "Core Platform" via text similarity')
    })

    it('handles null goals (runtime edge case)', async () => {
      const result = await classifyGoal(makeInput({ goals: null as unknown as ProductScopeGoal[] }))
      expect(result.matchedGoalId).toBeNull()
      expect(mockGenerateObject).not.toHaveBeenCalled()
    })
  })

  describe('LLM goal classification', () => {
    it('calls generateObject with goals formatted as numbered list', async () => {
      mockGenerateObject.mockResolvedValue({
        object: { goalId: 'goal-1', reasoning: 'Relates to onboarding' },
      })

      await classifyGoal(makeInput())
      const prompt = mockGenerateObject.mock.calls[0][0].prompt
      expect(prompt).toContain('1. [goal-1] Improve onboarding flow')
      expect(prompt).toContain('2. [goal-2] Reduce churn rate')
      expect(prompt).toContain('3. [goal-3] Increase API adoption')
    })

    it('includes entity name and scope info in prompt', async () => {
      mockGenerateObject.mockResolvedValue({
        object: { goalId: 'goal-1', reasoning: 'test' },
      })

      await classifyGoal(makeInput())
      const prompt = mockGenerateObject.mock.calls[0][0].prompt
      expect(prompt).toContain('Login Bug')
      expect(prompt).toContain('Core Platform')
      expect(prompt).toContain('Core platform features and infrastructure')
    })

    it('truncates contentSnippet to 1500 characters in the prompt', async () => {
      const longContent = 'Z'.repeat(3000)
      mockGenerateObject.mockResolvedValue({
        object: { goalId: null, reasoning: 'test' },
      })

      await classifyGoal(makeInput({ contentSnippet: longContent }))
      const prompt = mockGenerateObject.mock.calls[0][0].prompt
      // The prompt should contain at most 1500 Z's (no Z's elsewhere in template)
      const zCount = (prompt.match(/Z/g) || []).length
      expect(zCount).toBe(1500)
    })

    it('returns matching goal ID and text when LLM picks a valid goal', async () => {
      mockGenerateObject.mockResolvedValue({
        object: { goalId: 'goal-2', reasoning: 'This relates to churn' },
      })

      const result = await classifyGoal(makeInput())
      expect(result.matchedGoalId).toBe('goal-2')
      expect(result.matchedGoalText).toBe('Reduce churn rate')
      expect(result.reasoning).toBe('This relates to churn')
    })

    it('returns null goalId when LLM returns goalId as null', async () => {
      mockGenerateObject.mockResolvedValue({
        object: { goalId: null, reasoning: 'No goal is relevant' },
      })

      const result = await classifyGoal(makeInput())
      expect(result.matchedGoalId).toBeNull()
      expect(result.matchedGoalText).toBeNull()
      expect(result.reasoning).toBe('No goal is relevant')
    })

    it('returns null goalId when LLM returns a goalId that does not exist in goals array', async () => {
      mockGenerateObject.mockResolvedValue({
        object: { goalId: 'goal-nonexistent', reasoning: 'Hallucinated goal' },
      })

      const result = await classifyGoal(makeInput())
      expect(result.matchedGoalId).toBeNull()
      expect(result.matchedGoalText).toBeNull()
    })

    it('returns goal text from goals array, not from LLM response', async () => {
      mockGenerateObject.mockResolvedValue({
        object: { goalId: 'goal-1', reasoning: 'Matches onboarding' },
      })

      const result = await classifyGoal(makeInput())
      // Text comes from the goals array definition, not LLM
      expect(result.matchedGoalText).toBe('Improve onboarding flow')
    })
  })

  describe('LLM failure fallback', () => {
    it('returns null goalId when generateObject throws', async () => {
      mockGenerateObject.mockRejectedValue(new Error('API error'))

      const result = await classifyGoal(makeInput())
      expect(result.matchedGoalId).toBeNull()
      expect(result.matchedGoalText).toBeNull()
    })

    it('includes "(goal classification unavailable)" in fallback reasoning with matchedTopic', async () => {
      mockGenerateObject.mockRejectedValue(new Error('fail'))

      const result = await classifyGoal(makeInput({ matchedTopic: 'billing' }))
      expect(result.reasoning).toBe('Matched via topic: billing (goal classification unavailable)')
    })

    it('includes scope name in fallback reasoning when matchedTopic is undefined', async () => {
      mockGenerateObject.mockRejectedValue(new Error('fail'))

      const result = await classifyGoal(makeInput({ matchedTopic: undefined }))
      expect(result.reasoning).toBe('Matched to scope "Core Platform" (goal classification unavailable)')
    })

    it('does not throw - error is swallowed', async () => {
      mockGenerateObject.mockRejectedValue(new Error('fail'))

      await expect(classifyGoal(makeInput())).resolves.toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('handles single goal in array', async () => {
      mockGenerateObject.mockResolvedValue({
        object: { goalId: 'only-goal', reasoning: 'Only option' },
      })

      const result = await classifyGoal(makeInput({
        goals: [{ id: 'only-goal', text: 'The only goal' }],
      }))
      expect(result.matchedGoalId).toBe('only-goal')
      expect(result.matchedGoalText).toBe('The only goal')
    })
  })
})
