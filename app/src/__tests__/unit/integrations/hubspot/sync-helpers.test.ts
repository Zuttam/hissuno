import { describe, it, expect } from 'vitest'
import {
  toMergeStrategy,
  extractCustomFields,
  mapHubSpotCompany,
  mapHubSpotContact,
  type HubSpotCompany,
  type HubSpotContact,
} from '@/lib/integrations/hubspot/sync-helpers'

describe('toMergeStrategy', () => {
  it('returns overwrite for hubspot_wins', () => {
    expect(toMergeStrategy('hubspot_wins')).toBe('overwrite')
  })

  it('returns fill_nulls for fill_nulls', () => {
    expect(toMergeStrategy('fill_nulls')).toBe('fill_nulls')
  })

  it('returns never_overwrite for never_overwrite', () => {
    expect(toMergeStrategy('never_overwrite')).toBe('never_overwrite')
  })
})

describe('extractCustomFields', () => {
  it('returns custom fields prefixed with hubspot_', () => {
    const properties = { name: 'Acme', custom_prop: 'value1' }
    const mappedKeys = new Set(['name'])
    const result = extractCustomFields(properties, mappedKeys)
    expect(result).toEqual({ hubspot_custom_prop: 'value1' })
  })

  it('filters out mapped keys', () => {
    const properties = { name: 'Acme', domain: 'acme.com', extra: 'yes' }
    const mappedKeys = new Set(['name', 'domain'])
    const result = extractCustomFields(properties, mappedKeys)
    expect(result).toEqual({ hubspot_extra: 'yes' })
  })

  it('skips null values', () => {
    const properties = { extra: null, other: 'val' }
    const mappedKeys = new Set<string>()
    const result = extractCustomFields(properties, mappedKeys)
    expect(result).toEqual({ hubspot_other: 'val' })
  })

  it('skips undefined values', () => {
    const properties = { extra: undefined, other: 'val' }
    const mappedKeys = new Set<string>()
    const result = extractCustomFields(properties, mappedKeys)
    expect(result).toEqual({ hubspot_other: 'val' })
  })

  it('skips empty string values', () => {
    const properties = { extra: '', other: 'val' }
    const mappedKeys = new Set<string>()
    const result = extractCustomFields(properties, mappedKeys)
    expect(result).toEqual({ hubspot_other: 'val' })
  })

  it('returns empty object when all properties are mapped or empty', () => {
    const properties = { name: 'Acme', domain: '' }
    const mappedKeys = new Set(['name'])
    const result = extractCustomFields(properties, mappedKeys)
    expect(result).toEqual({})
  })
})

describe('mapHubSpotCompany', () => {
  it('returns mapped fields for a minimal company', () => {
    const hsCompany: HubSpotCompany = {
      id: 'c1',
      properties: { domain: 'acme.com' },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    }
    const result = mapHubSpotCompany(hsCompany)
    expect(result.domain).toBe('acme.com')
    expect(result.name).toBeNull()
    expect(result.industry).toBeNull()
    expect(result.country).toBeNull()
    expect(result.employeeCount).toBeNull()
    expect(result.notes).toBeNull()
    expect(result.customFields).toEqual({})
  })

  it('returns all fields for a full company', () => {
    const hsCompany: HubSpotCompany = {
      id: 'c2',
      properties: {
        name: 'Acme Corp',
        domain: 'acme.com',
        industry: 'Technology',
        country: 'US',
        numberofemployees: '250',
        annualrevenue: '5000000',
        description: 'A tech company',
        phone: '+1-555-0100',
        website: 'https://acme.com',
        hs_object_id: '12345',
        notes_last_updated: '2024-01-01',
        custom_extra: 'extra_val',
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    }
    const result = mapHubSpotCompany(hsCompany)
    expect(result.name).toBe('Acme Corp')
    expect(result.domain).toBe('acme.com')
    expect(result.industry).toBe('Technology')
    expect(result.country).toBe('US')
    expect(result.employeeCount).toBe(250)
    expect(result.notes).toBe('A tech company')
    expect(result.customFields).toEqual({
      hubspot_annual_revenue: 5000000,
      hubspot_custom_extra: 'extra_val',
    })
  })

  it('handles non-numeric employeeCount gracefully', () => {
    const hsCompany: HubSpotCompany = {
      id: 'c3',
      properties: { domain: 'test.com', numberofemployees: 'not-a-number' },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const result = mapHubSpotCompany(hsCompany)
    expect(result.employeeCount).toBeNull()
  })
})

describe('mapHubSpotContact', () => {
  it('returns mapped fields for a minimal contact', () => {
    const hsContact: HubSpotContact = {
      id: 'ct1',
      properties: { email: 'jane@acme.com' },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    }
    const result = mapHubSpotContact(hsContact)
    expect(result.email).toBe('jane@acme.com')
    expect(result.name).toBeNull()
    expect(result.phone).toBeNull()
    expect(result.title).toBeNull()
    expect(result.customFields).toEqual({})
  })

  it('returns all fields for a full contact', () => {
    const hsContact: HubSpotContact = {
      id: 'ct2',
      properties: {
        firstname: 'Jane',
        lastname: 'Doe',
        email: 'jane@acme.com',
        phone: '+1-555-0199',
        jobtitle: 'VP Engineering',
        company: 'Acme Corp',
        hs_object_id: '67890',
        notes_last_updated: '2024-06-01',
        lifecyclestage: 'customer',
        custom_field: 'custom_val',
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    }
    const result = mapHubSpotContact(hsContact)
    expect(result.name).toBe('Jane Doe')
    expect(result.email).toBe('jane@acme.com')
    expect(result.phone).toBe('+1-555-0199')
    expect(result.title).toBe('VP Engineering')
    expect(result.customFields).toEqual({
      hubspot_lifecycle_stage: 'customer',
      hubspot_custom_field: 'custom_val',
    })
  })

  it('handles missing optional fields', () => {
    const hsContact: HubSpotContact = {
      id: 'ct3',
      properties: {
        firstname: 'Bob',
        email: 'bob@test.com',
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const result = mapHubSpotContact(hsContact)
    expect(result.name).toBe('Bob')
    expect(result.email).toBe('bob@test.com')
    expect(result.phone).toBeNull()
    expect(result.title).toBeNull()
    expect(result.customFields).toEqual({})
  })
})
