import { fetchApi, fetchApiRaw, buildUrl } from './fetch'
import type {
  CustomFieldDefinition,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
} from '@/types/ontology'
import type { EntityType } from '@/lib/db/queries/types'

const paths = {
  fields: '/api/settings/ontology/fields',
  field: (fieldId: string) => `/api/settings/ontology/fields/${fieldId}`,
}

export async function listCustomFields(projectId: string, entityType?: EntityType): Promise<CustomFieldDefinition[]> {
  const url = buildUrl(paths.fields, { projectId, entity_type: entityType })
  const { fields } = await fetchApi<{ fields: CustomFieldDefinition[] }>(url, {
    errorMessage: 'Failed to load custom fields.',
  })
  return fields ?? []
}

export async function createCustomField(projectId: string, input: CreateCustomFieldInput): Promise<CustomFieldDefinition> {
  const { field } = await fetchApi<{ field: CustomFieldDefinition }>(buildUrl(paths.fields, { projectId }), {
    method: 'POST',
    body: input,
    errorMessage: 'Failed to create custom field.',
  })
  return field
}

export async function updateCustomField(projectId: string, fieldId: string, updates: UpdateCustomFieldInput): Promise<CustomFieldDefinition> {
  const { field } = await fetchApi<{ field: CustomFieldDefinition }>(buildUrl(paths.field(fieldId), { projectId }), {
    method: 'PATCH',
    body: updates,
    errorMessage: 'Failed to update custom field.',
  })
  return field
}

export async function deleteCustomField(projectId: string, fieldId: string): Promise<void> {
  await fetchApiRaw(buildUrl(paths.field(fieldId), { projectId }), { method: 'DELETE' })
}
