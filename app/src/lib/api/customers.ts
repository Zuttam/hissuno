import { fetchApi, fetchApiRaw, buildUrl } from './fetch'
import type {
  CustomFieldDefinition,
  CustomerEntityType,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
  CustomersStripAnalytics,
  CSVImportMapping,
  CSVImportResult,
} from '@/types/customer'

const paths = {
  customFields: '/api/settings/customers/custom-fields',
  customField: (fieldId: string) => `/api/settings/customers/custom-fields/${fieldId}`,

  importUpload: '/api/contacts/import/upload',
  importParse: '/api/contacts/import/parse',
  import: '/api/contacts/import',
}

export async function listCustomFields(projectId: string, entityType?: CustomerEntityType): Promise<CustomFieldDefinition[]> {
  const url = buildUrl(paths.customFields, { projectId, entity_type: entityType })
  const { fields } = await fetchApi<{ fields: CustomFieldDefinition[] }>(url, {
    errorMessage: 'Failed to load custom fields.',
  })
  return fields ?? []
}

export async function createCustomField(projectId: string, input: CreateCustomFieldInput): Promise<CustomFieldDefinition> {
  const { field } = await fetchApi<{ field: CustomFieldDefinition }>(buildUrl(paths.customFields, { projectId }), {
    method: 'POST',
    body: input,
    errorMessage: 'Failed to create custom field.',
  })
  return field
}

export async function updateCustomField(projectId: string, fieldId: string, updates: UpdateCustomFieldInput): Promise<CustomFieldDefinition> {
  const { field } = await fetchApi<{ field: CustomFieldDefinition }>(buildUrl(paths.customField(fieldId), { projectId }), {
    method: 'PATCH',
    body: updates,
    errorMessage: 'Failed to update custom field.',
  })
  return field
}

export async function deleteCustomField(projectId: string, fieldId: string): Promise<void> {
  await fetchApiRaw(buildUrl(paths.customField(fieldId), { projectId }), { method: 'DELETE' })
}

export async function getCustomerAnalytics(projectId: string): Promise<CustomersStripAnalytics | null> {
  const [companiesRes, contactsRes] = await Promise.all([
    fetchApi<{ companies: { id: string; arr: number | null; stage: string | null }[]; total: number }>(
      buildUrl('/api/companies', { projectId, limit: 1000 }),
      { errorMessage: 'Failed to load companies.' },
    ),
    fetchApi<{ contacts: { id: string; is_champion: boolean }[]; total: number }>(
      buildUrl('/api/contacts', { projectId, limit: 1000 }),
      { errorMessage: 'Failed to load contacts.' },
    ),
  ])

  const companies = companiesRes.companies ?? []
  const contacts = contactsRes.contacts ?? []

  const totalARR = companies.reduce((sum, c) => sum + (c.arr ?? 0), 0)
  const companiesWithARR = companies.filter((c) => c.arr && c.arr > 0)

  const stageCounts = new Map<string, number>()
  companies.forEach((c) => {
    const stage = c.stage ?? 'prospect'
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1)
  })

  const byStage = Array.from(stageCounts.entries()).map(([label, value]) => ({
    label,
    value,
    percentage: companies.length > 0 ? Math.round((value / companies.length) * 100) : 0,
  }))

  return {
    totalCompanies: companiesRes.total,
    totalContacts: contactsRes.total,
    champions: contacts.filter((c) => c.is_champion).length,
    totalARR,
    avgARR: companiesWithARR.length > 0 ? Math.round(totalARR / companiesWithARR.length) : 0,
    byStage,
  }
}

export async function requestImportUpload(projectId: string, filename: string, fileSize: number) {
  return fetchApi<{ uploadUrl: string; storagePath: string }>(
    buildUrl(paths.importUpload, { projectId }),
    { method: 'POST', body: { filename, fileSize }, errorMessage: 'Failed to prepare upload.' },
  )
}

export async function directImportUpload(projectId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return fetchApi<{ storagePath: string }>(
    buildUrl(paths.importUpload, { projectId }),
    { method: 'POST', formData, errorMessage: 'Failed to upload file.' },
  )
}

export async function parseImportCSV(projectId: string, storagePath: string, entityType: CustomerEntityType) {
  return fetchApi<{ rowCount: number; sampleRows: Record<string, string>[]; suggestedMappings: CSVImportMapping[] }>(
    buildUrl(paths.importParse, { projectId }),
    { method: 'POST', body: { storagePath, entityType }, errorMessage: 'Failed to parse CSV.' },
  )
}

export async function executeImport(
  projectId: string,
  storagePath: string,
  entityType: CustomerEntityType,
  mappings: CSVImportMapping[],
  createMissingCompanies: boolean,
) {
  return fetchApi<{ result: CSVImportResult }>(
    buildUrl(paths.import, { projectId }),
    {
      method: 'POST',
      body: { storagePath, entityType, mappings, createMissingCompanies },
      errorMessage: 'Import failed.',
    },
  )
}
