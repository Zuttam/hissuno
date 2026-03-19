/**
 * Unit tests for RICE score calculation and priority mapping.
 */

import { describe, it, expect } from 'vitest'
import { calculateRICEScore, riceScoreToPriority } from '@/lib/issues/rice'

describe('calculateRICEScore', () => {
  it('calculates (reach * impact * confidence) / effort', () => {
    // (5 * 4 * 3) / 2 = 30
    expect(calculateRICEScore(5, 4, 3, 2)).toBe(30)
  })

  it('defaults confidence to 3 when null', () => {
    // (5 * 4 * 3) / 2 = 30
    expect(calculateRICEScore(5, 4, null, 2)).toBe(30)
  })

  it('returns null when reach is null', () => {
    expect(calculateRICEScore(null, 4, 3, 2)).toBeNull()
  })

  it('returns null when impact is null', () => {
    expect(calculateRICEScore(5, null, 3, 2)).toBeNull()
  })

  it('returns null when effort is null', () => {
    expect(calculateRICEScore(5, 4, 3, null)).toBeNull()
  })

  it('clamps effort to minimum of 1 to prevent division by zero', () => {
    // (5 * 4 * 3) / 1 = 60  (effort 0 clamped to 1)
    expect(calculateRICEScore(5, 4, 3, 0)).toBe(60)
  })

  it('clamps negative effort to 1', () => {
    // (5 * 4 * 3) / 1 = 60
    expect(calculateRICEScore(5, 4, 3, -5)).toBe(60)
  })

  it('handles all scores of 1', () => {
    // (1 * 1 * 1) / 1 = 1
    expect(calculateRICEScore(1, 1, 1, 1)).toBe(1)
  })

  it('handles all scores of 5', () => {
    // (5 * 5 * 5) / 5 = 25
    expect(calculateRICEScore(5, 5, 5, 5)).toBe(25)
  })
})

describe('riceScoreToPriority', () => {
  it('returns null for null score', () => {
    expect(riceScoreToPriority(null)).toBeNull()
  })

  it('returns "high" for score >= 20', () => {
    expect(riceScoreToPriority(20)).toBe('high')
    expect(riceScoreToPriority(100)).toBe('high')
  })

  it('returns "medium" for score >= 5 and < 20', () => {
    expect(riceScoreToPriority(5)).toBe('medium')
    expect(riceScoreToPriority(19.9)).toBe('medium')
  })

  it('returns "low" for score < 5', () => {
    expect(riceScoreToPriority(4.9)).toBe('low')
    expect(riceScoreToPriority(0)).toBe('low')
    expect(riceScoreToPriority(1)).toBe('low')
  })

  it('handles boundary values exactly', () => {
    expect(riceScoreToPriority(4.999)).toBe('low')
    expect(riceScoreToPriority(5)).toBe('medium')
    expect(riceScoreToPriority(19.999)).toBe('medium')
    expect(riceScoreToPriority(20)).toBe('high')
  })
})
