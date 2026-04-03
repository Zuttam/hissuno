import type { customFieldDefinitions } from '@/lib/db/schema/app'
import type { EntityType } from '@/lib/db/queries/types'

// ============================================================================
// Constants
// ============================================================================

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select', 'multi_select'] as const
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]

// ============================================================================
// Custom Field Types
// ============================================================================

type CustomFieldRow = typeof customFieldDefinitions.$inferSelect

/**
 * Custom field definition with stricter types than raw database row.
 */
export interface CustomFieldDefinition extends Omit<CustomFieldRow, 'entity_type' | 'field_type' | 'is_required'> {
  entity_type: EntityType
  field_type: CustomFieldType
  is_required: boolean
}

export interface CreateCustomFieldInput {
  project_id: string
  entity_type: EntityType
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
