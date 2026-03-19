/**
 * Unit Tests for Issue Service Priority Calculation
 *
 * Tests the calculatePriority function with additional edge cases
 * beyond what issue-analysis.test.ts covers.
 */

import { describe, it, expect } from 'vitest'
import { calculatePriority } from '@/lib/issues/issues-service'

describe('calculatePriority edge cases', () => {
  it('returns "low" for negative upvote count', () => {
    expect(calculatePriority(-1)).toBe('low')
  })

  it('returns "high" for very large upvote counts', () => {
    expect(calculatePriority(1000)).toBe('high')
    expect(calculatePriority(Number.MAX_SAFE_INTEGER)).toBe('high')
  })

  it('boundary: 2 upvotes is low, 3 is medium', () => {
    expect(calculatePriority(2)).toBe('low')
    expect(calculatePriority(3)).toBe('medium')
  })

  it('boundary: 4 upvotes is medium, 5 is high', () => {
    expect(calculatePriority(4)).toBe('medium')
    expect(calculatePriority(5)).toBe('high')
  })

  it('returns consistent results across all threshold values', () => {
    const expectations: Array<[number, string]> = [
      [0, 'low'],
      [1, 'low'],
      [2, 'low'],
      [3, 'medium'],
      [4, 'medium'],
      [5, 'high'],
      [6, 'high'],
      [10, 'high'],
      [50, 'high'],
    ]
    for (const [count, expected] of expectations) {
      expect(calculatePriority(count)).toBe(expected)
    }
  })
})
