/**
 * Pure helper functions for Notion issue sync.
 */

import { extractPropertyValue } from './property-mapper'

/** Notion API returns properties keyed by their name. */
export function findPropertyByName(
  properties: Record<string, unknown>,
  propertyName: string
): Record<string, unknown> | null {
  const prop = properties[propertyName]
  return prop ? (prop as Record<string, unknown>) : null
}

export function extractStringByPropertyName(
  properties: Record<string, unknown>,
  propertyName: string
): string {
  const prop = findPropertyByName(properties, propertyName)
  if (!prop) return ''
  const val = extractPropertyValue(prop)
  if (Array.isArray(val)) return val.join(', ')
  return val != null ? String(val) : ''
}

export function mapPropertyValue(
  properties: Record<string, unknown>,
  propertyName: string | undefined,
  valueMap: Record<string, string> | undefined,
  defaultValue: string,
  validValues: Set<string>
): string {
  if (!propertyName) return defaultValue

  const rawValue = extractStringByPropertyName(properties, propertyName)
  if (!rawValue) return defaultValue

  // Try to find a mapped value
  if (valueMap) {
    const mapped = valueMap[rawValue]
    if (mapped && validValues.has(mapped)) return mapped
  }

  // Try the raw value directly (case-insensitive)
  const normalized = rawValue.toLowerCase().replace(/\s+/g, '_')
  if (validValues.has(normalized)) return normalized

  return defaultValue
}
