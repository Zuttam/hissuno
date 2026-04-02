import { fetchApi, buildUrl } from './fetch'
import type {
  CustomersStripAnalytics,
  CSVImportMapping,
  CSVImportResult,
} from '@/types/customer'
import type { EntityType } from '@/lib/db/queries/types'

const paths = {
  importUpload: '/api/contacts/import/upload',
  importParse: '/api/contacts/import/parse',
  import: '/api/contacts/import',
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

export async function parseImportCSV(projectId: string, storagePath: string, entityType: EntityType) {
  return fetchApi<{ rowCount: number; sampleRows: Record<string, string>[]; suggestedMappings: CSVImportMapping[] }>(
    buildUrl(paths.importParse, { projectId }),
    { method: 'POST', body: { storagePath, entityType }, errorMessage: 'Failed to parse CSV.' },
  )
}

export async function executeImport(
  projectId: string,
  storagePath: string,
  entityType: EntityType,
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
