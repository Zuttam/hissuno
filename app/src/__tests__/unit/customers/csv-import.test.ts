/**
 * Unit Tests for CSV Import Service
 *
 * Tests CSV parsing, column mapping suggestions, and row validation.
 * Pure function tests - no database mocking needed.
 */

import { describe, it, expect } from 'vitest'
import { parseCSVContent, suggestMappings } from '@/lib/customers/csv-import'
import type { CustomFieldDefinition } from '@/types/customer'

// ============================================================================
// parseCSVContent
// ============================================================================

describe('parseCSVContent', () => {
  it('parses a simple CSV with headers and rows', () => {
    const csv = `name,domain,arr
Acme Inc,acme.com,50000
Beta Corp,beta.io,120000`

    const result = parseCSVContent(csv)

    expect(result.headers).toEqual(['name', 'domain', 'arr'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ name: 'Acme Inc', domain: 'acme.com', arr: '50000' })
    expect(result.rows[1]).toEqual({ name: 'Beta Corp', domain: 'beta.io', arr: '120000' })
  })

  it('handles quoted fields with commas', () => {
    const csv = `name,address,notes
"Smith, John","123 Main St, Suite 4","A ""special"" client"`

    const result = parseCSVContent(csv)

    expect(result.headers).toEqual(['name', 'address', 'notes'])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].name).toBe('Smith, John')
    expect(result.rows[0].address).toBe('123 Main St, Suite 4')
    expect(result.rows[0].notes).toBe('A "special" client')
  })

  it('handles Windows-style line endings', () => {
    const csv = "name,email\r\nAlice,alice@test.com\r\nBob,bob@test.com"

    const result = parseCSVContent(csv)

    expect(result.headers).toEqual(['name', 'email'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].email).toBe('alice@test.com')
  })

  it('returns empty arrays for empty input', () => {
    const result = parseCSVContent('')

    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
  })

  it('returns headers only when no data rows', () => {
    const csv = 'name,email,role'

    const result = parseCSVContent(csv)

    expect(result.headers).toEqual(['name', 'email', 'role'])
    expect(result.rows).toEqual([])
  })

  it('handles trailing empty lines', () => {
    const csv = `name,email
Alice,alice@test.com

`

    const result = parseCSVContent(csv)

    expect(result.rows).toHaveLength(1)
  })

  it('handles rows with fewer values than headers', () => {
    const csv = `name,email,role
Alice,alice@test.com`

    const result = parseCSVContent(csv)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({ name: 'Alice', email: 'alice@test.com', role: '' })
  })

  it('trims whitespace from values', () => {
    const csv = `name , email
 Alice , alice@test.com `

    const result = parseCSVContent(csv)

    expect(result.headers).toEqual(['name', 'email'])
    expect(result.rows[0]).toEqual({ name: 'Alice', email: 'alice@test.com' })
  })
})

// ============================================================================
// suggestMappings
// ============================================================================

describe('suggestMappings', () => {
  describe('company mappings', () => {
    it('maps exact field names', () => {
      const headers = ['name', 'domain', 'arr', 'stage']
      const mappings = suggestMappings(headers, 'company')

      expect(mappings).toHaveLength(4)
      expect(mappings[0].targetField).toBe('name')
      expect(mappings[1].targetField).toBe('domain')
      expect(mappings[2].targetField).toBe('arr')
      expect(mappings[3].targetField).toBe('stage')
    })

    it('maps known aliases', () => {
      const headers = ['company_name', 'website', 'annual_revenue', 'lifecycle_stage']
      const mappings = suggestMappings(headers, 'company')

      expect(mappings[0].targetField).toBe('name')
      expect(mappings[1].targetField).toBe('domain')
      expect(mappings[2].targetField).toBe('arr')
      expect(mappings[3].targetField).toBe('stage')
    })

    it('maps headers with spaces and hyphens', () => {
      const headers = ['company name', 'health-score', 'employee count']
      const mappings = suggestMappings(headers, 'company')

      expect(mappings[0].targetField).toBe('name')
      expect(mappings[1].targetField).toBe('health_score')
      expect(mappings[2].targetField).toBe('employee_count')
    })

    it('returns null targetField for unknown headers', () => {
      const headers = ['random_column', 'unknown_field']
      const mappings = suggestMappings(headers, 'company')

      expect(mappings[0].targetField).toBeNull()
      expect(mappings[1].targetField).toBeNull()
    })

    it('initializes sample values as empty arrays', () => {
      const headers = ['name']
      const mappings = suggestMappings(headers, 'company')

      expect(mappings[0].sampleValues).toEqual([])
    })
  })

  describe('contact mappings', () => {
    it('maps exact field names', () => {
      const headers = ['name', 'email', 'role', 'title', 'phone']
      const mappings = suggestMappings(headers, 'contact')

      expect(mappings[0].targetField).toBe('name')
      expect(mappings[1].targetField).toBe('email')
      expect(mappings[2].targetField).toBe('role')
      expect(mappings[3].targetField).toBe('title')
      expect(mappings[4].targetField).toBe('phone')
    })

    it('maps contact aliases', () => {
      const headers = ['full_name', 'email_address', 'job_title', 'telephone']
      const mappings = suggestMappings(headers, 'contact')

      expect(mappings[0].targetField).toBe('name')
      expect(mappings[1].targetField).toBe('email')
      expect(mappings[2].targetField).toBe('title')
      expect(mappings[3].targetField).toBe('phone')
    })

    it('maps champion aliases', () => {
      const headers = ['champion', 'advocate']
      const mappings = suggestMappings(headers, 'contact')

      expect(mappings[0].targetField).toBe('is_champion')
      expect(mappings[1].targetField).toBe('is_champion')
    })
  })

  describe('custom field mappings', () => {
    it('maps to custom fields when matching field_key', () => {
      const headers = ['priority_level']
      const customFields: CustomFieldDefinition[] = [
        {
          id: 'cf-1',
          project_id: 'proj-1',
          entity_type: 'company',
          field_key: 'priority_level',
          field_label: 'Priority Level',
          field_type: 'text',
          select_options: null,
          position: 0,
          is_required: false,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
      ]

      const mappings = suggestMappings(headers, 'company', customFields)

      expect(mappings[0].targetField).toBe('custom:priority_level')
    })

    it('maps to custom fields when matching field_label', () => {
      const headers = ['Priority Level']
      const customFields: CustomFieldDefinition[] = [
        {
          id: 'cf-1',
          project_id: 'proj-1',
          entity_type: 'company',
          field_key: 'prio_lvl',
          field_label: 'Priority Level',
          field_type: 'text',
          select_options: null,
          position: 0,
          is_required: false,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
      ]

      const mappings = suggestMappings(headers, 'company', customFields)

      expect(mappings[0].targetField).toBe('custom:prio_lvl')
    })

    it('prefers standard fields over custom fields', () => {
      const headers = ['name']
      const customFields: CustomFieldDefinition[] = [
        {
          id: 'cf-1',
          project_id: 'proj-1',
          entity_type: 'company',
          field_key: 'name',
          field_label: 'Name',
          field_type: 'text',
          select_options: null,
          position: 0,
          is_required: false,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
      ]

      const mappings = suggestMappings(headers, 'company', customFields)

      // Standard field 'name' should take priority
      expect(mappings[0].targetField).toBe('name')
    })
  })
})
