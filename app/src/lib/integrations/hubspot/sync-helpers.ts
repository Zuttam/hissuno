/**
 * Pure helper functions for HubSpot sync mapping.
 * Maps HubSpot CRM records to Hissuno data model fields.
 */

import type { HubSpotCompany, HubSpotContact } from './client'
import type { OverwritePolicy } from './index'
import type { MergeStrategy } from '@/lib/customers/customers-service'

export type { OverwritePolicy, MergeStrategy, HubSpotCompany, HubSpotContact }

/**
 * Map HubSpot OverwritePolicy to service MergeStrategy.
 */
export function toMergeStrategy(policy: OverwritePolicy): MergeStrategy {
  if (policy === 'hubspot_wins') return 'overwrite'
  return policy // 'fill_nulls' | 'never_overwrite' map directly
}

/**
 * Extract extra HubSpot properties into custom_fields, prefixed with hubspot_
 */
export function extractCustomFields(
  properties: Record<string, string | null | undefined>,
  mappedKeys: Set<string>
): Record<string, unknown> {
  const custom: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (!mappedKeys.has(key) && value !== null && value !== undefined && value !== '') {
      custom[`hubspot_${key}`] = value
    }
  }
  return custom
}

/**
 * Map a HubSpot company to Hissuno company fields
 */
export const MAPPED_COMPANY_KEYS = new Set([
  'name', 'domain', 'industry', 'country', 'numberofemployees', 'annualrevenue',
  'hs_object_id', 'notes_last_updated', 'description', 'phone', 'website',
])

export function mapHubSpotCompany(hsCompany: HubSpotCompany): {
  name: string | null
  domain: string | null
  industry: string | null
  country: string | null
  employeeCount: number | null
  notes: string | null
  customFields: Record<string, unknown>
} {
  const p = hsCompany.properties
  const employeeCount = p.numberofemployees ? parseInt(p.numberofemployees, 10) : null

  // Store annual revenue in custom_fields (it's not the same as ARR)
  const customFields = extractCustomFields(p, MAPPED_COMPANY_KEYS)
  if (p.annualrevenue) {
    customFields.hubspot_annual_revenue = parseFloat(p.annualrevenue)
  }

  return {
    name: p.name || null,
    domain: p.domain || null,
    industry: p.industry || null,
    country: p.country || null,
    employeeCount: !isNaN(employeeCount as number) ? employeeCount : null,
    notes: p.description || null,
    customFields,
  }
}

/**
 * Map a HubSpot contact to Hissuno contact fields
 */
export const MAPPED_CONTACT_KEYS = new Set([
  'firstname', 'lastname', 'email', 'phone', 'jobtitle', 'company',
  'hs_object_id', 'notes_last_updated', 'lifecyclestage',
])

export function mapHubSpotContact(hsContact: HubSpotContact): {
  name: string | null
  email: string | null
  phone: string | null
  title: string | null
  customFields: Record<string, unknown>
} {
  const p = hsContact.properties
  const firstName = p.firstname || ''
  const lastName = p.lastname || ''
  const name = [firstName, lastName].filter(Boolean).join(' ') || null

  const customFields = extractCustomFields(p, MAPPED_CONTACT_KEYS)
  if (p.lifecyclestage) {
    customFields.hubspot_lifecycle_stage = p.lifecyclestage
  }

  return {
    name,
    email: p.email || null,
    phone: p.phone || null,
    title: p.jobtitle || null,
    customFields,
  }
}
