/**
 * Unit tests for Notion property value extraction, type mapping, and field key generation.
 */

import { describe, it, expect } from 'vitest'
import {
  extractPropertyValue,
  notionTypeToCustomFieldType,
  propertyNameToFieldKey,
} from '@/lib/integrations/notion/property-mapper'

describe('extractPropertyValue', () => {
  it('returns joined plain_text for title property', () => {
    const prop = {
      type: 'title',
      title: [
        { plain_text: 'Hello' },
        { plain_text: ' World' },
      ],
    }
    expect(extractPropertyValue(prop)).toBe('Hello World')
  })

  it('returns empty string for title with empty array', () => {
    const prop = { type: 'title', title: [] }
    expect(extractPropertyValue(prop)).toBe('')
  })

  it('returns empty string for title with null data', () => {
    const prop = { type: 'title', title: null }
    expect(extractPropertyValue(prop)).toBe('')
  })

  it('returns joined plain_text for rich_text property', () => {
    const prop = {
      type: 'rich_text',
      rich_text: [{ plain_text: 'Some text' }],
    }
    expect(extractPropertyValue(prop)).toBe('Some text')
  })

  it('returns empty string for rich_text with empty array', () => {
    const prop = { type: 'rich_text', rich_text: [] }
    expect(extractPropertyValue(prop)).toBe('')
  })

  it('returns empty string for rich_text with null data', () => {
    const prop = { type: 'rich_text', rich_text: null }
    expect(extractPropertyValue(prop)).toBe('')
  })

  it('returns numeric value for number property', () => {
    const prop = { type: 'number', number: 42 }
    expect(extractPropertyValue(prop)).toBe(42)
  })

  it('returns null for number property with null data', () => {
    const prop = { type: 'number', number: null }
    expect(extractPropertyValue(prop)).toBeNull()
  })

  it('returns name for select property', () => {
    const prop = { type: 'select', select: { name: 'Option A' } }
    expect(extractPropertyValue(prop)).toBe('Option A')
  })

  it('returns null for select property with null data', () => {
    const prop = { type: 'select', select: null }
    expect(extractPropertyValue(prop)).toBeNull()
  })

  it('returns array of names for multi_select property', () => {
    const prop = {
      type: 'multi_select',
      multi_select: [{ name: 'Tag1' }, { name: 'Tag2' }],
    }
    expect(extractPropertyValue(prop)).toEqual(['Tag1', 'Tag2'])
  })

  it('returns empty array for multi_select with empty array', () => {
    const prop = { type: 'multi_select', multi_select: [] }
    expect(extractPropertyValue(prop)).toEqual([])
  })

  it('returns name for status property', () => {
    const prop = { type: 'status', status: { name: 'In Progress' } }
    expect(extractPropertyValue(prop)).toBe('In Progress')
  })

  it('returns null for status property with null data', () => {
    const prop = { type: 'status', status: null }
    expect(extractPropertyValue(prop)).toBeNull()
  })

  it('returns start date string for date property', () => {
    const prop = { type: 'date', date: { start: '2024-01-15' } }
    expect(extractPropertyValue(prop)).toBe('2024-01-15')
  })

  it('returns null for date property with null data', () => {
    const prop = { type: 'date', date: null }
    expect(extractPropertyValue(prop)).toBeNull()
  })

  it('returns array of names for people property', () => {
    const prop = {
      type: 'people',
      people: [
        { id: 'u1', name: 'Alice' },
        { id: 'u2', name: 'Bob' },
      ],
    }
    expect(extractPropertyValue(prop)).toEqual(['Alice', 'Bob'])
  })

  it('returns id when people entry has no name', () => {
    const prop = {
      type: 'people',
      people: [{ id: 'u1' }],
    }
    expect(extractPropertyValue(prop)).toEqual(['u1'])
  })

  it('returns boolean for checkbox property', () => {
    const prop = { type: 'checkbox', checkbox: true }
    expect(extractPropertyValue(prop)).toBe(true)
  })

  it('returns false for unchecked checkbox property', () => {
    const prop = { type: 'checkbox', checkbox: false }
    expect(extractPropertyValue(prop)).toBe(false)
  })

  it('returns string for url property', () => {
    const prop = { type: 'url', url: 'https://example.com' }
    expect(extractPropertyValue(prop)).toBe('https://example.com')
  })

  it('returns string for email property', () => {
    const prop = { type: 'email', email: 'test@example.com' }
    expect(extractPropertyValue(prop)).toBe('test@example.com')
  })

  it('returns string for phone_number property', () => {
    const prop = { type: 'phone_number', phone_number: '+1234567890' }
    expect(extractPropertyValue(prop)).toBe('+1234567890')
  })

  it('returns formula result value', () => {
    const prop = {
      type: 'formula',
      formula: { type: 'number', number: 99 },
    }
    expect(extractPropertyValue(prop)).toBe(99)
  })

  it('returns null for formula with null data', () => {
    const prop = { type: 'formula', formula: null }
    expect(extractPropertyValue(prop)).toBeNull()
  })

  it('returns rollup result value', () => {
    const prop = {
      type: 'rollup',
      rollup: { type: 'number', number: 10 },
    }
    expect(extractPropertyValue(prop)).toBe(10)
  })

  it('returns null for rollup with null data', () => {
    const prop = { type: 'rollup', rollup: null }
    expect(extractPropertyValue(prop)).toBeNull()
  })

  it('returns timestamp string for created_time property', () => {
    const prop = { type: 'created_time', created_time: '2024-01-01T00:00:00.000Z' }
    expect(extractPropertyValue(prop)).toBe('2024-01-01T00:00:00.000Z')
  })

  it('returns timestamp string for last_edited_time property', () => {
    const prop = { type: 'last_edited_time', last_edited_time: '2024-06-15T12:30:00.000Z' }
    expect(extractPropertyValue(prop)).toBe('2024-06-15T12:30:00.000Z')
  })

  it('returns name for created_by property', () => {
    const prop = { type: 'created_by', created_by: { id: 'u1', name: 'Alice' } }
    expect(extractPropertyValue(prop)).toBe('Alice')
  })

  it('returns null for created_by when name is missing', () => {
    const prop = { type: 'created_by', created_by: { id: 'u1' } }
    expect(extractPropertyValue(prop)).toBeNull()
  })

  it('returns name for last_edited_by property', () => {
    const prop = { type: 'last_edited_by', last_edited_by: { id: 'u2', name: 'Bob' } }
    expect(extractPropertyValue(prop)).toBe('Bob')
  })

  it('returns null for unknown property type', () => {
    const prop = { type: 'relation', relation: [{ id: 'page1' }] }
    expect(extractPropertyValue(prop)).toBeNull()
  })
})

describe('notionTypeToCustomFieldType', () => {
  it('returns number for number type', () => {
    expect(notionTypeToCustomFieldType('number')).toBe('number')
  })

  it('returns date for date type', () => {
    expect(notionTypeToCustomFieldType('date')).toBe('date')
  })

  it('returns date for created_time type', () => {
    expect(notionTypeToCustomFieldType('created_time')).toBe('date')
  })

  it('returns date for last_edited_time type', () => {
    expect(notionTypeToCustomFieldType('last_edited_time')).toBe('date')
  })

  it('returns boolean for checkbox type', () => {
    expect(notionTypeToCustomFieldType('checkbox')).toBe('boolean')
  })

  it('returns select for select type', () => {
    expect(notionTypeToCustomFieldType('select')).toBe('select')
  })

  it('returns select for status type', () => {
    expect(notionTypeToCustomFieldType('status')).toBe('select')
  })

  it('returns text for rich_text type', () => {
    expect(notionTypeToCustomFieldType('rich_text')).toBe('text')
  })

  it('returns text for title type', () => {
    expect(notionTypeToCustomFieldType('title')).toBe('text')
  })

  it('returns text for url type', () => {
    expect(notionTypeToCustomFieldType('url')).toBe('text')
  })

  it('returns text for unknown type', () => {
    expect(notionTypeToCustomFieldType('formula')).toBe('text')
  })
})

describe('propertyNameToFieldKey', () => {
  it('lowercases the name', () => {
    expect(propertyNameToFieldKey('Status')).toBe('status')
  })

  it('replaces special characters with underscores', () => {
    expect(propertyNameToFieldKey('Due Date')).toBe('due_date')
  })

  it('replaces multiple special characters', () => {
    expect(propertyNameToFieldKey('My (Custom) Field!')).toBe('my_custom_field')
  })

  it('collapses consecutive underscores', () => {
    expect(propertyNameToFieldKey('a---b')).toBe('a_b')
  })

  it('strips leading underscores', () => {
    expect(propertyNameToFieldKey('_leading')).toBe('leading')
  })

  it('strips trailing underscores', () => {
    expect(propertyNameToFieldKey('trailing_')).toBe('trailing')
  })

  it('strips both leading and trailing underscores', () => {
    expect(propertyNameToFieldKey('__both__')).toBe('both')
  })

  it('truncates to 50 characters', () => {
    const longName = 'a'.repeat(60)
    expect(propertyNameToFieldKey(longName).length).toBe(50)
  })

  it('returns field for empty string after sanitization', () => {
    expect(propertyNameToFieldKey('')).toBe('field')
  })

  it('returns field when name is only special characters', () => {
    expect(propertyNameToFieldKey('!@#$%')).toBe('field')
  })

  it('handles mixed alphanumeric and special characters', () => {
    expect(propertyNameToFieldKey('Task ID #123')).toBe('task_id_123')
  })
})
