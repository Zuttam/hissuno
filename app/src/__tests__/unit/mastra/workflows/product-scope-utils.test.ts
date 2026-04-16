import { describe, it, expect } from 'vitest'
import { buildProductScopePromptSection, resolveProductScopeId } from '@/mastra/workflows/common/product-scope-utils'
import type { ProductScopeRecord } from '@/types/product-scope'

function makeScope(overrides: Partial<ProductScopeRecord> = {}): ProductScopeRecord {
  return {
    id: 'area-1',
    project_id: 'proj-1',
    parent_id: null,
    name: 'Core Platform',
    slug: 'core_platform',
    description: 'Core platform features',
    color: 'info',
    position: 0,
    depth: 0,
    is_default: false,
    type: 'product_area',
    goals: null,
    content: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildProductScopePromptSection', () => {
  it('returns empty string for empty scopes', () => {
    expect(buildProductScopePromptSection([], 'issue')).toBe('')
  })

  it('builds markdown table with slug/name/type/description columns', () => {
    const scopes = [makeScope()]
    const result = buildProductScopePromptSection(scopes, 'issue')
    expect(result).toContain('| Slug | Name | Type | Description |')
    expect(result).toContain('| core_platform | Core Platform | Product Area | Core platform features |')
  })

  it('marks default scope with "(default)"', () => {
    const scopes = [
      makeScope({ is_default: true, slug: 'default_scope', name: 'Default' }),
      makeScope({ slug: 'other', name: 'Other', id: 'area-2' }),
    ]
    const result = buildProductScopePromptSection(scopes, 'issue')
    expect(result).toContain('(default)')
    // Non-default should not have the marker
    const lines = result.split('\n')
    const otherLine = lines.find((l) => l.includes('| other |'))
    expect(otherLine).not.toContain('(default)')
  })

  it('uses entityNoun in instruction text', () => {
    const scopes = [makeScope()]
    const resultIssue = buildProductScopePromptSection(scopes, 'issue')
    expect(resultIssue).toContain('Assign the issue')

    const resultSession = buildProductScopePromptSection(scopes, 'session')
    expect(resultSession).toContain('Assign the session')
  })

  it('includes Product Scopes heading', () => {
    const scopes = [makeScope()]
    const result = buildProductScopePromptSection(scopes, 'issue')
    expect(result).toContain('## Product Scopes')
  })
})

describe('resolveProductScopeId', () => {
  const scopes = [
    makeScope({ id: 'area-1', slug: 'core_platform' }),
    makeScope({ id: 'area-2', slug: 'billing' }),
  ]

  it('returns scope ID for matching slug', () => {
    expect(resolveProductScopeId(scopes, 'core_platform')).toBe('area-1')
    expect(resolveProductScopeId(scopes, 'billing')).toBe('area-2')
  })

  it('returns null for null slug', () => {
    expect(resolveProductScopeId(scopes, null)).toBeNull()
  })

  it('returns null for undefined slug', () => {
    expect(resolveProductScopeId(scopes, undefined)).toBeNull()
  })

  it('returns null for non-matching slug', () => {
    expect(resolveProductScopeId(scopes, 'nonexistent')).toBeNull()
  })

  it('returns null for empty scopes array', () => {
    expect(resolveProductScopeId([], 'core_platform')).toBeNull()
  })
})
