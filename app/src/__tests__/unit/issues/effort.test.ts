import { describe, it, expect } from 'vitest'
import { mapEffortToScore, mapScoreToEffort } from '@/lib/issues/effort'
import type { EffortEstimate } from '@/types/issue'

describe('mapEffortToScore', () => {
  it('maps trivial to 1', () => {
    expect(mapEffortToScore('trivial')).toBe(1)
  })

  it('maps small to 2', () => {
    expect(mapEffortToScore('small')).toBe(2)
  })

  it('maps medium to 3', () => {
    expect(mapEffortToScore('medium')).toBe(3)
  })

  it('maps large to 4', () => {
    expect(mapEffortToScore('large')).toBe(4)
  })

  it('maps xlarge to 5', () => {
    expect(mapEffortToScore('xlarge')).toBe(5)
  })

  it('returns null for null input', () => {
    expect(mapEffortToScore(null)).toBeNull()
  })

  it('returns null for unknown estimate', () => {
    expect(mapEffortToScore('unknown' as EffortEstimate)).toBeNull()
  })
})

describe('mapScoreToEffort', () => {
  it('maps score <= 1 to trivial', () => {
    expect(mapScoreToEffort(0)).toBe('trivial')
    expect(mapScoreToEffort(1)).toBe('trivial')
  })

  it('maps score <= 2 to small', () => {
    expect(mapScoreToEffort(1.5)).toBe('small')
    expect(mapScoreToEffort(2)).toBe('small')
  })

  it('maps score <= 3 to medium', () => {
    expect(mapScoreToEffort(2.5)).toBe('medium')
    expect(mapScoreToEffort(3)).toBe('medium')
  })

  it('maps score <= 4 to large', () => {
    expect(mapScoreToEffort(3.5)).toBe('large')
    expect(mapScoreToEffort(4)).toBe('large')
  })

  it('maps score > 4 to xlarge', () => {
    expect(mapScoreToEffort(4.5)).toBe('xlarge')
    expect(mapScoreToEffort(5)).toBe('xlarge')
  })
})
