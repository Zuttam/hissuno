import type { companies, contacts, customerCustomFieldDefinitions } from '@/lib/db/schema/app'

// ============================================================================
// Constants
// ============================================================================

export const COMPANY_STAGES = ['prospect', 'onboarding', 'active', 'churned', 'expansion'] as const
export type CompanyStage = (typeof COMPANY_STAGES)[number]

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select'] as const
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]

export type CustomerEntityType = 'company' | 'contact'

// ============================================================================
// Base Row Types (from Drizzle schema)
// ============================================================================

type CompanyRow = typeof companies.$inferSelect
type ContactRow = typeof contacts.$inferSelect
type CustomFieldRow = typeof customerCustomFieldDefinitions.$inferSelect

// ============================================================================
// Company Types
// ============================================================================

/**
 * Company record with stricter types than raw database row.
 * Overrides nullable booleans/enums with non-nullable versions.
 */
export interface CompanyRecord extends Omit<CompanyRow, 'stage' | 'is_archived' | 'custom_fields'> {
  stage: CompanyStage
  is_archived: boolean
  custom_fields: Record<string, unknown>
}

export interface CompanyWithContacts extends CompanyRecord {
  contacts: { id: string; name: string; email: string }[]
  contact_count: number
}

export interface CreateCompanyInput {
  project_id: string
  name: string
  domain: string
  arr?: number | null
  stage?: CompanyStage
  product_used?: string | null
  industry?: string | null
  employee_count?: number | null
  plan_tier?: string | null
  renewal_date?: string | null
  health_score?: number | null
  country?: string | null
  notes?: string | null
  custom_fields?: Record<string, unknown>
}

export interface UpdateCompanyInput {
  name?: string
  domain?: string
  arr?: number | null
  stage?: CompanyStage
  product_used?: string | null
  industry?: string | null
  employee_count?: number | null
  plan_tier?: string | null
  renewal_date?: string | null
  health_score?: number | null
  country?: string | null
  notes?: string | null
  custom_fields?: Record<string, unknown>
}

export interface CompanyFilters {
  projectId?: string
  stage?: CompanyStage
  search?: string
  industry?: string
  planTier?: string
  country?: string
  showArchived?: boolean
  limit?: number
  offset?: number
}

// ============================================================================
// Contact Types
// ============================================================================

/**
 * Contact record with stricter types than raw database row.
 */
export interface ContactRecord extends Omit<ContactRow, 'is_champion' | 'is_archived' | 'custom_fields'> {
  is_champion: boolean
  is_archived: boolean
  custom_fields: Record<string, unknown>
}

export interface ContactWithCompany extends ContactRecord {
  company: {
    id: string
    name: string
    domain: string
  } | null
}

export interface CreateContactInput {
  project_id: string
  name: string
  email: string
  company_id?: string | null
  role?: string | null
  title?: string | null
  phone?: string | null
  company_url?: string | null
  is_champion?: boolean
  last_contacted_at?: string | null
  notes?: string | null
  custom_fields?: Record<string, unknown>
}

export interface UpdateContactInput {
  name?: string
  email?: string
  company_id?: string | null
  role?: string | null
  title?: string | null
  phone?: string | null
  company_url?: string | null
  is_champion?: boolean
  last_contacted_at?: string | null
  notes?: string | null
  custom_fields?: Record<string, unknown>
}

export interface ContactFilters {
  projectId?: string
  companyId?: string
  isChampion?: boolean
  search?: string
  role?: string
  title?: string
  showArchived?: boolean
  limit?: number
  offset?: number
}

// ============================================================================
// Custom Field Types
// ============================================================================

/**
 * Custom field definition with stricter types than raw database row.
 */
export interface CustomFieldDefinition extends Omit<CustomFieldRow, 'entity_type' | 'field_type' | 'is_required'> {
  entity_type: CustomerEntityType
  field_type: CustomFieldType
  is_required: boolean
}

export interface CreateCustomFieldInput {
  project_id: string
  entity_type: CustomerEntityType
  field_key: string
  field_label: string
  field_type: CustomFieldType
  select_options?: string[]
  position?: number
  is_required?: boolean
}

export interface UpdateCustomFieldInput {
  field_label?: string
  field_type?: CustomFieldType
  select_options?: string[]
  position?: number
  is_required?: boolean
}

// ============================================================================
// CSV Import Types
// ============================================================================

export interface CSVImportMapping {
  csvColumn: string
  targetField: string | null
  sampleValues: string[]
}

export interface CSVImportResult {
  created: number
  updated: number
  errors: { row: number; message: string }[]
  total: number
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface CustomersStripAnalytics {
  totalCompanies: number
  totalContacts: number
  champions: number
  totalARR: number
  avgARR: number
  byStage: { label: string; value: number; percentage: number }[]
}
