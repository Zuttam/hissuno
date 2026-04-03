import { describe, it, expect } from 'vitest'
import {
  findPropertyByName,
  extractStringByPropertyName,
  mapPropertyValue,
} from '@/lib/integrations/notion/sync-issue-helpers'

describe('findPropertyByName', () => {
  it('returns the property when found', () => {
    const properties = {
      Title: { type: 'title', title: [{ plain_text: 'Hello' }] },
    }
    const result = findPropertyByName(properties, 'Title')
    expect(result).toEqual({ type: 'title', title: [{ plain_text: 'Hello' }] })
  })

  it('returns null when property not found', () => {
    const properties = {
      Title: { type: 'title', title: [{ plain_text: 'Hello' }] },
    }
    const result = findPropertyByName(properties, 'Missing')
    expect(result).toBeNull()
  })

  it('returns null for empty properties', () => {
    const result = findPropertyByName({}, 'Anything')
    expect(result).toBeNull()
  })
})

describe('extractStringByPropertyName', () => {
  it('returns string value for a select property', () => {
    const properties = {
      Status: { type: 'select', select: { name: 'Open' } },
    }
    const result = extractStringByPropertyName(properties, 'Status')
    expect(result).toBe('Open')
  })

  it('returns joined string for array values (multi_select)', () => {
    const properties = {
      Tags: { type: 'multi_select', multi_select: [{ name: 'bug' }, { name: 'urgent' }] },
    }
    const result = extractStringByPropertyName(properties, 'Tags')
    expect(result).toBe('bug, urgent')
  })

  it('returns empty string when property value is null', () => {
    const properties = {
      Notes: { type: 'rich_text', rich_text: [] },
    }
    const result = extractStringByPropertyName(properties, 'Notes')
    expect(result).toBe('')
  })

  it('returns empty string for missing property', () => {
    const result = extractStringByPropertyName({}, 'Missing')
    expect(result).toBe('')
  })
})

describe('mapPropertyValue', () => {
  const validStatuses = new Set(['open', 'ready', 'in_progress', 'resolved', 'closed'])

  it('returns default when propertyName is undefined', () => {
    const result = mapPropertyValue({}, undefined, undefined, 'open', validStatuses)
    expect(result).toBe('open')
  })

  it('returns default when raw value is empty', () => {
    const properties = {
      Status: { type: 'rich_text', rich_text: [] },
    }
    const result = mapPropertyValue(properties, 'Status', undefined, 'open', validStatuses)
    expect(result).toBe('open')
  })

  it('returns mapped value when found and valid', () => {
    const properties = {
      Status: { type: 'select', select: { name: 'Done' } },
    }
    const valueMap = { Done: 'resolved' }
    const result = mapPropertyValue(properties, 'Status', valueMap, 'open', validStatuses)
    expect(result).toBe('resolved')
  })

  it('returns default when mapped value is not in validValues', () => {
    const properties = {
      Status: { type: 'select', select: { name: 'Done' } },
    }
    const valueMap = { Done: 'invalid_status' }
    const result = mapPropertyValue(properties, 'Status', valueMap, 'open', validStatuses)
    expect(result).toBe('open')
  })

  it('returns normalized raw value when it matches validValues', () => {
    const properties = {
      Status: { type: 'select', select: { name: 'In Progress' } },
    }
    const result = mapPropertyValue(properties, 'Status', undefined, 'open', validStatuses)
    expect(result).toBe('in_progress')
  })

  it('returns default when raw value does not match any valid value', () => {
    const properties = {
      Status: { type: 'select', select: { name: 'Backlog' } },
    }
    const result = mapPropertyValue(properties, 'Status', undefined, 'open', validStatuses)
    expect(result).toBe('open')
  })

  it('handles case-insensitive normalization', () => {
    const properties = {
      Priority: { type: 'select', select: { name: 'HIGH' } },
    }
    const validPriorities = new Set(['low', 'medium', 'high'])
    const result = mapPropertyValue(properties, 'Priority', undefined, 'medium', validPriorities)
    expect(result).toBe('high')
  })
})
