/**
 * Unit Tests for Sanitize Knowledge Step
 *
 * Tests the redaction pattern detection and counting logic
 * used by the sanitize-knowledge workflow step.
 */

import { describe, it, expect } from 'vitest'

// ============================================================================
// Redaction Pattern Detection (mirrors the step implementation)
// ============================================================================

const REDACTION_PATTERNS = [
  { pattern: /\[REDACTED_AWS_KEY\]/g, type: 'aws_key' },
  { pattern: /\[REDACTED_API_KEY\]/g, type: 'api_key' },
  { pattern: /\[REDACTED_GITHUB_TOKEN\]/g, type: 'github_token' },
  { pattern: /\[REDACTED_DATABASE_URL\]/g, type: 'database_url' },
  { pattern: /\[REDACTED_PASSWORD\]/g, type: 'password' },
  { pattern: /\[REDACTED_PRIVATE_KEY\]/g, type: 'private_key' },
  { pattern: /\[REDACTED_INTERNAL_IP\]/g, type: 'internal_ip' },
  { pattern: /\[REDACTED_SECRET\]/g, type: 'secret' },
  { pattern: /\[REDACTED_TOKEN\]/g, type: 'token' },
  { pattern: /\[REDACTED_CREDENTIAL\]/g, type: 'credential' },
]

function countRedactions(content: string): { count: number; types: Set<string> } {
  let count = 0
  const types = new Set<string>()

  for (const { pattern, type } of REDACTION_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      count += matches.length
      types.add(type)
    }
  }

  return { count, types }
}

// ============================================================================
// Tests
// ============================================================================

describe('Redaction Pattern Detection', () => {
  it('detects no redactions in clean content', () => {
    const content = `# Clean Documentation

This is documentation without any sensitive information.

## Features
- Feature 1
- Feature 2
`
    const { count, types } = countRedactions(content)
    
    expect(count).toBe(0)
    expect(types.size).toBe(0)
  })

  it('detects single API key redaction', () => {
    const content = `# API Documentation

Use this key for authentication: [REDACTED_API_KEY]
`
    const { count, types } = countRedactions(content)
    
    expect(count).toBe(1)
    expect(types.has('api_key')).toBe(true)
  })

  it('detects multiple redactions of the same type', () => {
    const content = `# Configuration

Primary API key: [REDACTED_API_KEY]
Secondary API key: [REDACTED_API_KEY]
Backup API key: [REDACTED_API_KEY]
`
    const { count, types } = countRedactions(content)
    
    expect(count).toBe(3)
    expect(types.size).toBe(1)
    expect(types.has('api_key')).toBe(true)
  })

  it('detects multiple redaction types', () => {
    const content = `# Technical Setup

## Authentication
API Key: [REDACTED_API_KEY]
GitHub Token: [REDACTED_GITHUB_TOKEN]

## Database
Connection string: [REDACTED_DATABASE_URL]
Password: [REDACTED_PASSWORD]

## AWS
Access Key: [REDACTED_AWS_KEY]
`
    const { count, types } = countRedactions(content)
    
    expect(count).toBe(5)
    expect(types.size).toBe(5)
    expect(types.has('api_key')).toBe(true)
    expect(types.has('github_token')).toBe(true)
    expect(types.has('database_url')).toBe(true)
    expect(types.has('password')).toBe(true)
    expect(types.has('aws_key')).toBe(true)
  })

  it('detects all supported redaction types', () => {
    const content = `
[REDACTED_AWS_KEY]
[REDACTED_API_KEY]
[REDACTED_GITHUB_TOKEN]
[REDACTED_DATABASE_URL]
[REDACTED_PASSWORD]
[REDACTED_PRIVATE_KEY]
[REDACTED_INTERNAL_IP]
[REDACTED_SECRET]
[REDACTED_TOKEN]
[REDACTED_CREDENTIAL]
`
    const { count, types } = countRedactions(content)
    
    expect(count).toBe(10)
    expect(types.size).toBe(10)
  })

  it('handles empty content', () => {
    const { count, types } = countRedactions('')
    
    expect(count).toBe(0)
    expect(types.size).toBe(0)
  })

  it('handles content with similar but non-matching patterns', () => {
    const content = `
REDACTED_API_KEY (no brackets)
[REDACTED API KEY] (with spaces)
[redacted_api_key] (lowercase)
[REDACTED_UNKNOWN_TYPE]
`
    const { count, types } = countRedactions(content)
    
    expect(count).toBe(0)
    expect(types.size).toBe(0)
  })

  it('detects redactions inline with other text', () => {
    const content = `The connection string postgresql://user:[REDACTED_PASSWORD]@[REDACTED_INTERNAL_IP]:5432/db was sanitized.`
    
    const { count, types } = countRedactions(content)
    
    expect(count).toBe(2)
    expect(types.has('password')).toBe(true)
    expect(types.has('internal_ip')).toBe(true)
  })
})

describe('Redaction Summary Structure', () => {
  it('produces correct summary for mixed content', () => {
    const businessContent = `Company uses [REDACTED_API_KEY] for integrations.`
    const productContent = `Product connects to [REDACTED_DATABASE_URL] and uses [REDACTED_API_KEY].`
    const technicalContent = `
## Configuration
- AWS Key: [REDACTED_AWS_KEY]
- GitHub: [REDACTED_GITHUB_TOKEN]
- Internal: [REDACTED_INTERNAL_IP]
- Secret: [REDACTED_SECRET]
`
    
    const businessStats = countRedactions(businessContent)
    const productStats = countRedactions(productContent)
    const technicalStats = countRedactions(technicalContent)
    
    // Build summary similar to the step
    const allTypes = new Set<string>()
    businessStats.types.forEach(t => allTypes.add(t))
    productStats.types.forEach(t => allTypes.add(t))
    technicalStats.types.forEach(t => allTypes.add(t))
    
    const summary = {
      totalRedactions: businessStats.count + productStats.count + technicalStats.count,
      byCategory: {
        business: businessStats.count,
        product: productStats.count,
        technical: technicalStats.count,
      },
      types: Array.from(allTypes),
    }
    
    expect(summary.totalRedactions).toBe(7)
    expect(summary.byCategory.business).toBe(1)
    expect(summary.byCategory.product).toBe(2)
    expect(summary.byCategory.technical).toBe(4)
    expect(summary.types).toContain('api_key')
    expect(summary.types).toContain('database_url')
    expect(summary.types).toContain('aws_key')
    expect(summary.types).toContain('github_token')
    expect(summary.types).toContain('internal_ip')
    expect(summary.types).toContain('secret')
  })
})
