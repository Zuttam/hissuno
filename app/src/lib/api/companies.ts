import { fetchApi, fetchApiRaw, buildUrl } from './fetch'
import type { CompanyWithContacts, CreateCompanyInput, UpdateCompanyInput } from '@/types/customer'

const paths = {
  list: '/api/companies',
  detail: (c: string) => `/api/companies/${c}`,
  archive: (c: string) => `/api/companies/${c}/archive`,
  activity: (c: string) => `/api/companies/${c}/activity`,
}

export interface CompanyListParams {
  stage?: string
  search?: string
  industry?: string
  planTier?: string
  country?: string
  showArchived?: boolean
  limit?: number
  offset?: number
}

export async function listCompanies(projectId: string, params?: CompanyListParams) {
  return fetchApi<{ companies: CompanyWithContacts[]; total: number }>(
    buildUrl(paths.list, { projectId, ...params as Record<string, string | number | boolean | undefined | null> }),
    { errorMessage: 'Failed to load companies.' },
  )
}

export async function getCompany(projectId: string, companyId: string) {
  return fetchApi<{ company: CompanyWithContacts }>(
    buildUrl(paths.detail(companyId), { projectId }),
    { errorMessage: 'Failed to load company.' },
  )
}

export async function createCompany(projectId: string, input: CreateCompanyInput) {
  return fetchApi<{ company: CompanyWithContacts }>(
    buildUrl(paths.list, { projectId }),
    { method: 'POST', body: input, errorMessage: 'Failed to create company.' },
  )
}

export async function updateCompany(projectId: string, companyId: string, updates: UpdateCompanyInput) {
  return fetchApi<{ company: CompanyWithContacts }>(
    buildUrl(paths.detail(companyId), { projectId }),
    { method: 'PATCH', body: updates, errorMessage: 'Failed to update company.' },
  )
}

export async function deleteCompany(projectId: string, companyId: string) {
  return fetchApiRaw(buildUrl(paths.detail(companyId), { projectId }), { method: 'DELETE' })
}

export async function archiveCompany(projectId: string, companyId: string, isArchived: boolean) {
  return fetchApiRaw(buildUrl(paths.archive(companyId), { projectId }), {
    method: 'PATCH',
    body: { is_archived: isArchived },
  })
}

export interface CompanyActivity {
  sessions: Array<{ id: string; name: string | null; source: string; created_at: string }>
  issues: Array<{ id: string; title: string; type: string; status: string }>
}

export async function getCompanyActivity(projectId: string, companyId: string) {
  return fetchApi<CompanyActivity>(
    buildUrl(paths.activity(companyId), { projectId }),
    { errorMessage: 'Failed to load company activity.' },
  )
}
