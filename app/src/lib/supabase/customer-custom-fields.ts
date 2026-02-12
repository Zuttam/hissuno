/**
 * Customer Custom Field Definitions Database Layer
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CustomFieldDefinition,
  CustomerEntityType,
  UpdateCustomFieldInput,
} from '@/types/customer'

// ============================================================================
// Pure DB Operations
// ============================================================================

export interface InsertCustomFieldData {
  projectId: string
  entityType: CustomerEntityType
  fieldKey: string
  fieldLabel: string
  fieldType: string
  selectOptions?: string[]
  position?: number
  isRequired?: boolean
}

export async function listCustomFieldDefinitions(
  supabase: SupabaseClient,
  projectId: string,
  entityType?: CustomerEntityType
): Promise<CustomFieldDefinition[]> {
  let query = supabase
    .from('customer_custom_field_definitions')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  const { data, error } = await query

  if (error) {
    console.error('[supabase.customFields] failed to list definitions', error)
    throw new Error('Unable to load custom field definitions.')
  }

  return (data ?? []) as CustomFieldDefinition[]
}

export async function createCustomFieldDefinition(
  supabase: SupabaseClient,
  data: InsertCustomFieldData
): Promise<CustomFieldDefinition> {
  // Check max 10 fields per entity type
  const { count, error: countError } = await supabase
    .from('customer_custom_field_definitions')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', data.projectId)
    .eq('entity_type', data.entityType)

  if (countError) {
    console.error('[supabase.customFields.create] failed to count existing fields', countError)
    throw new Error('Failed to validate field count.')
  }

  if ((count ?? 0) >= 10) {
    throw new Error(`Maximum of 10 custom fields per entity type reached.`)
  }

  const { data: field, error } = await supabase
    .from('customer_custom_field_definitions')
    .insert({
      project_id: data.projectId,
      entity_type: data.entityType,
      field_key: data.fieldKey,
      field_label: data.fieldLabel,
      field_type: data.fieldType,
      select_options: data.selectOptions ?? null,
      position: data.position ?? 0,
      is_required: data.isRequired ?? false,
    })
    .select()
    .single()

  if (error || !field) {
    console.error('[supabase.customFields.create] Failed', error)
    throw new Error(`Failed to create custom field: ${error?.message ?? 'Unknown error'}`)
  }

  return field as CustomFieldDefinition
}

export async function updateCustomFieldDefinition(
  supabase: SupabaseClient,
  fieldId: string,
  data: UpdateCustomFieldInput,
  projectId?: string
): Promise<CustomFieldDefinition> {
  const updates: Record<string, unknown> = {}
  if (data.field_label !== undefined) updates.field_label = data.field_label
  if (data.field_type !== undefined) updates.field_type = data.field_type
  if (data.select_options !== undefined) updates.select_options = data.select_options
  if (data.position !== undefined) updates.position = data.position
  if (data.is_required !== undefined) updates.is_required = data.is_required

  let query = supabase
    .from('customer_custom_field_definitions')
    .update(updates)
    .eq('id', fieldId)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data: field, error } = await query
    .select()
    .single()

  if (error || !field) {
    console.error('[supabase.customFields.update] Failed', fieldId, error)
    throw new Error(`Failed to update custom field: ${error?.message ?? 'Unknown error'}`)
  }

  return field as CustomFieldDefinition
}

export async function deleteCustomFieldDefinition(
  supabase: SupabaseClient,
  fieldId: string,
  projectId?: string
): Promise<boolean> {
  let query = supabase
    .from('customer_custom_field_definitions')
    .delete()
    .eq('id', fieldId)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { error } = await query

  if (error) {
    console.error('[supabase.customFields.delete] Failed', fieldId, error)
    throw new Error(`Failed to delete custom field: ${error.message}`)
  }

  return true
}
