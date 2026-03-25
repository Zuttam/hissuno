/**
 * Unit Tests for Contact Embedding Text Builder
 *
 * Tests the pure function that constructs embedding text from contact fields.
 * This text is what gets vectorized for semantic search over contacts.
 */

import { describe, it, expect } from 'vitest'
import { buildContactEmbeddingText } from '@/lib/customers/customer-embedding-service'

describe('buildContactEmbeddingText', () => {
  it('includes name and email as required fields', () => {
    const result = buildContactEmbeddingText({
      name: 'Jane Doe',
      email: 'jane@acme.com',
    })
    expect(result).toContain('Jane Doe')
    expect(result).toContain('jane@acme.com')
  })

  it('includes role when provided', () => {
    const result = buildContactEmbeddingText({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      role: 'Engineering Lead',
    })
    expect(result).toContain('Role: Engineering Lead')
  })

  it('includes title when provided', () => {
    const result = buildContactEmbeddingText({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      title: 'VP of Engineering',
    })
    expect(result).toContain('Title: VP of Engineering')
  })

  it('includes company name when provided', () => {
    const result = buildContactEmbeddingText({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      companyName: 'Acme Corp',
    })
    expect(result).toContain('Company: Acme Corp')
  })

  it('includes notes when provided', () => {
    const result = buildContactEmbeddingText({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      notes: 'Key decision maker for Q1 renewal',
    })
    expect(result).toContain('Notes: Key decision maker for Q1 renewal')
  })

  it('omits null fields', () => {
    const result = buildContactEmbeddingText({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      role: null,
      title: null,
      companyName: null,
      notes: null,
    })
    expect(result).not.toContain('Role:')
    expect(result).not.toContain('Title:')
    expect(result).not.toContain('Company:')
    expect(result).not.toContain('Notes:')
  })

  it('omits undefined fields', () => {
    const result = buildContactEmbeddingText({
      name: 'Jane Doe',
      email: 'jane@acme.com',
    })
    const lines = result.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('Jane Doe')
    expect(lines[1]).toBe('jane@acme.com')
  })

  it('joins all fields with newlines', () => {
    const result = buildContactEmbeddingText({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      role: 'Engineer',
      title: 'Senior Engineer',
      companyName: 'Acme Corp',
      notes: 'Champion',
    })
    const lines = result.split('\n')
    expect(lines).toHaveLength(6)
    expect(lines[0]).toBe('Jane Doe')
    expect(lines[1]).toBe('jane@acme.com')
    expect(lines[2]).toBe('Role: Engineer')
    expect(lines[3]).toBe('Title: Senior Engineer')
    expect(lines[4]).toBe('Company: Acme Corp')
    expect(lines[5]).toBe('Notes: Champion')
  })

  it('handles empty string fields as falsy (omitted)', () => {
    const result = buildContactEmbeddingText({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      role: '',
      title: '',
    })
    expect(result).not.toContain('Role:')
    expect(result).not.toContain('Title:')
  })
})
