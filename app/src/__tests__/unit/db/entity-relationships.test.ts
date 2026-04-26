/**
 * Unit tests for entity-relationships helpers (pure functions only).
 * Tests columnName() mapping and ENTITY_COLUMNS structure.
 */

import { describe, it, expect } from 'vitest'
import { columnName, ENTITY_COLUMNS } from '@/lib/db/queries/entity-relationships'
import type { EntityType } from '@/lib/db/queries/types'

describe('columnName', () => {
  const expectedMappings: Record<EntityType, string> = {
    company: 'company_id',
    contact: 'contact_id',
    issue: 'issue_id',
    session: 'session_id',
    knowledge_source: 'knowledge_source_id',
    codebase: 'codebase_id',
    product_scope: 'product_scope_id',
  }

  for (const [type, expected] of Object.entries(expectedMappings)) {
    it(`maps "${type}" to "${expected}"`, () => {
      expect(columnName(type as EntityType)).toBe(expected)
    })
  }
})

describe('ENTITY_COLUMNS', () => {
  it('has entries for all 7 entity types', () => {
    const types: EntityType[] = ['company', 'contact', 'issue', 'session', 'knowledge_source', 'codebase', 'product_scope']
    for (const type of types) {
      expect(ENTITY_COLUMNS).toHaveProperty(type)
      expect(ENTITY_COLUMNS[type]).toBeDefined()
    }
  })

  it('has exactly 7 entries', () => {
    expect(Object.keys(ENTITY_COLUMNS)).toHaveLength(7)
  })
})
