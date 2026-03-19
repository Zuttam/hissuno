/**
 * Customer Custom Field Definitions Queries (Drizzle)
 */

import { eq, and, asc, count as drizzleCount } from 'drizzle-orm'
import { db } from '@/lib/db'
import { customerCustomFieldDefinitions } from '@/lib/db/schema/app'
import type {
  CustomFieldDefinition,
  CustomerEntityType,
  UpdateCustomFieldInput,
} from '@/types/customer'

export type CustomerCustomFieldRow = typeof customerCustomFieldDefinitions.$inferSelect
export type CustomerCustomFieldInsert = typeof customerCustomFieldDefinitions.$inferInsert

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
  projectId: string,
  entityType?: CustomerEntityType
): Promise<CustomFieldDefinition[]> {
  const conditions = [eq(customerCustomFieldDefinitions.project_id, projectId)]

  if (entityType) {
    conditions.push(eq(customerCustomFieldDefinitions.entity_type, entityType))
  }

  const rows = await db
    .select()
    .from(customerCustomFieldDefinitions)
    .where(and(...conditions))
    .orderBy(asc(customerCustomFieldDefinitions.position))

  return rows as unknown as CustomFieldDefinition[]
}

export async function createCustomFieldDefinition(
  data: InsertCustomFieldData
): Promise<CustomFieldDefinition> {
  // Check max 10 fields per entity type
  const [countResult] = await db
    .select({ count: drizzleCount() })
    .from(customerCustomFieldDefinitions)
    .where(
      and(
        eq(customerCustomFieldDefinitions.project_id, data.projectId),
        eq(customerCustomFieldDefinitions.entity_type, data.entityType)
      )
    )

  if ((countResult?.count ?? 0) >= 10) {
    throw new Error(`Maximum of 10 custom fields per entity type reached.`)
  }

  const [field] = await db
    .insert(customerCustomFieldDefinitions)
    .values({
      project_id: data.projectId,
      entity_type: data.entityType,
      field_key: data.fieldKey,
      field_label: data.fieldLabel,
      field_type: data.fieldType,
      select_options: data.selectOptions ?? null,
      position: data.position ?? 0,
      is_required: data.isRequired ?? false,
    })
    .returning()

  if (!field) {
    throw new Error('Failed to create custom field: Unknown error')
  }

  return field as unknown as CustomFieldDefinition
}

export async function updateCustomFieldDefinition(
  fieldId: string,
  data: UpdateCustomFieldInput,
  projectId?: string
): Promise<CustomFieldDefinition> {
  const updates: Partial<CustomerCustomFieldInsert> = {}
  if (data.field_label !== undefined) updates.field_label = data.field_label
  if (data.field_type !== undefined) updates.field_type = data.field_type
  if (data.select_options !== undefined) updates.select_options = data.select_options
  if (data.position !== undefined) updates.position = data.position
  if (data.is_required !== undefined) updates.is_required = data.is_required

  const conditions = [eq(customerCustomFieldDefinitions.id, fieldId)]
  if (projectId) {
    conditions.push(eq(customerCustomFieldDefinitions.project_id, projectId))
  }

  const [field] = await db
    .update(customerCustomFieldDefinitions)
    .set(updates)
    .where(and(...conditions))
    .returning()

  if (!field) {
    throw new Error('Failed to update custom field: Not found')
  }

  return field as unknown as CustomFieldDefinition
}

export async function deleteCustomFieldDefinition(
  fieldId: string,
  projectId?: string
): Promise<boolean> {
  const conditions = [eq(customerCustomFieldDefinitions.id, fieldId)]
  if (projectId) {
    conditions.push(eq(customerCustomFieldDefinitions.project_id, projectId))
  }

  await db
    .delete(customerCustomFieldDefinitions)
    .where(and(...conditions))

  return true
}
