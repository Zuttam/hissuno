/**
 * Extracts plain values from Notion page properties.
 * Handles all common Notion property types.
 */

import type { NotionRichText } from './client'

/** Extract a plain-text value from a Notion property. */
export function extractPropertyValue(property: Record<string, unknown>): unknown {
  const type = property.type as string
  const data = property[type]

  switch (type) {
    case 'title':
    case 'rich_text':
      return richTextToString(data as NotionRichText[] | null)
    case 'number':
      return data as number | null
    case 'select':
      return (data as { name: string } | null)?.name ?? null
    case 'multi_select':
      return ((data as Array<{ name: string }>) ?? []).map((o) => o.name)
    case 'status':
      return (data as { name: string } | null)?.name ?? null
    case 'date':
      return (data as { start: string } | null)?.start ?? null
    case 'people':
      return ((data as Array<{ name?: string; id: string }>) ?? []).map(
        (p) => p.name ?? p.id
      )
    case 'checkbox':
      return data as boolean
    case 'url':
    case 'email':
    case 'phone_number':
      return (data as string) ?? null
    case 'formula': {
      const formula = data as Record<string, unknown> | null
      if (!formula) return null
      const fType = formula.type as string
      return formula[fType] ?? null
    }
    case 'rollup': {
      const rollup = data as Record<string, unknown> | null
      if (!rollup) return null
      const rType = rollup.type as string
      return rollup[rType] ?? null
    }
    case 'created_time':
    case 'last_edited_time':
      return data as string | null
    case 'created_by':
    case 'last_edited_by':
      return (data as { name?: string; id: string } | null)?.name ?? null
    default:
      return null
  }
}

function richTextToString(richText: NotionRichText[] | null | undefined): string {
  if (!richText || richText.length === 0) return ''
  return richText.map((rt) => rt.plain_text).join('')
}

/** Infer the best Hissuno custom field type from a Notion property type. */
export function notionTypeToCustomFieldType(
  notionType: string
): 'text' | 'number' | 'date' | 'boolean' | 'select' {
  switch (notionType) {
    case 'number':
      return 'number'
    case 'date':
    case 'created_time':
    case 'last_edited_time':
      return 'date'
    case 'checkbox':
      return 'boolean'
    case 'select':
    case 'status':
      return 'select'
    default:
      return 'text'
  }
}

/** Generate a valid field_key from a Notion property name. */
export function propertyNameToFieldKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50)
    || 'field'
}
