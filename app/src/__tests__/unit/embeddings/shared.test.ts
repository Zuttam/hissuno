/**
 * Unit Tests for Shared Embedding Utilities
 *
 * Tests pure utility functions used across all embedding services:
 * pgVector formatting and text hashing.
 */

import { describe, it, expect } from 'vitest'
import { formatEmbeddingForPgVector, computeTextHash } from '@/lib/utils/embeddings'

// ============================================================================
// formatEmbeddingForPgVector
// ============================================================================

describe('formatEmbeddingForPgVector', () => {
  it('formats an embedding array as a pgvector string', () => {
    const embedding = [0.1, 0.2, 0.3]
    const result = formatEmbeddingForPgVector(embedding)
    expect(result).toBe('[0.1,0.2,0.3]')
  })

  it('handles single-element embedding', () => {
    const result = formatEmbeddingForPgVector([0.5])
    expect(result).toBe('[0.5]')
  })

  it('handles empty embedding array', () => {
    const result = formatEmbeddingForPgVector([])
    expect(result).toBe('[]')
  })

  it('handles negative values', () => {
    const result = formatEmbeddingForPgVector([-0.1, 0.2, -0.3])
    expect(result).toBe('[-0.1,0.2,-0.3]')
  })

  it('handles very small floating point numbers', () => {
    const result = formatEmbeddingForPgVector([1.234567e-10, 0.0, -9.8765e-5])
    expect(result).toMatch(/^\[.*\]$/)
    expect(result).toContain(',')
  })

  it('preserves full precision of floats', () => {
    const embedding = [0.123456789012345]
    const result = formatEmbeddingForPgVector(embedding)
    expect(result).toBe('[0.123456789012345]')
  })

  it('handles a typical 1536-dimension embedding', () => {
    const embedding = Array.from({ length: 1536 }, (_, i) => Math.sin(i) * 0.01)
    const result = formatEmbeddingForPgVector(embedding)
    expect(result).toMatch(/^\[/)
    expect(result).toMatch(/\]$/)
    // Should have 1535 commas (1536 elements - 1)
    const commaCount = (result.match(/,/g) || []).length
    expect(commaCount).toBe(1535)
  })
})

// ============================================================================
// computeTextHash
// ============================================================================

describe('computeTextHash', () => {
  it('returns a 32-character hex string (MD5)', () => {
    const hash = computeTextHash('hello world')
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it('returns consistent hash for same input', () => {
    const hash1 = computeTextHash('test input')
    const hash2 = computeTextHash('test input')
    expect(hash1).toBe(hash2)
  })

  it('returns different hashes for different inputs', () => {
    const hash1 = computeTextHash('input one')
    const hash2 = computeTextHash('input two')
    expect(hash1).not.toBe(hash2)
  })

  it('handles empty string', () => {
    const hash = computeTextHash('')
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
    // MD5 of empty string is well-known
    expect(hash).toBe('d41d8cd98f00b204e9800998ecf8427e')
  })

  it('handles unicode content', () => {
    const hash = computeTextHash('Hello world')
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is sensitive to whitespace differences', () => {
    const hash1 = computeTextHash('hello')
    const hash2 = computeTextHash(' hello')
    const hash3 = computeTextHash('hello ')
    expect(hash1).not.toBe(hash2)
    expect(hash1).not.toBe(hash3)
  })

  it('handles long text', () => {
    const longText = 'A'.repeat(100000)
    const hash = computeTextHash(longText)
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })
})
