import { fetchApi, fetchApiRaw, buildUrl } from './fetch'
import type { ContactWithCompany, CreateContactInput, UpdateContactInput } from '@/types/customer'
import type { ContactLinkedSession, ContactLinkedIssue } from '@/lib/db/queries/contacts'

const paths = {
  list: '/api/contacts',
  detail: (c: string) => `/api/contacts/${c}`,
  archive: (c: string) => `/api/contacts/${c}/archive`,
  sessions: (c: string) => `/api/contacts/${c}/sessions`,
  issues: (c: string) => `/api/contacts/${c}/issues`,
}

export interface ContactListParams {
  companyId?: string
  isChampion?: boolean
  search?: string
  role?: string
  title?: string
  showArchived?: boolean
  limit?: number
  offset?: number
}

export async function listContacts(projectId: string, params?: ContactListParams) {
  return fetchApi<{ contacts: ContactWithCompany[]; total: number }>(
    buildUrl(paths.list, { projectId, ...params as Record<string, string | number | boolean | undefined | null> }),
    { errorMessage: 'Failed to load contacts.' },
  )
}

export async function getContact(projectId: string, contactId: string) {
  return fetchApi<{ contact: ContactWithCompany }>(
    buildUrl(paths.detail(contactId), { projectId }),
    { errorMessage: 'Failed to load contact.' },
  )
}

export async function createContact(projectId: string, input: CreateContactInput) {
  return fetchApi<{ contact: ContactWithCompany }>(
    buildUrl(paths.list, { projectId }),
    { method: 'POST', body: input, errorMessage: 'Failed to create contact.' },
  )
}

export async function updateContact(projectId: string, contactId: string, updates: UpdateContactInput) {
  return fetchApi<{ contact: ContactWithCompany }>(
    buildUrl(paths.detail(contactId), { projectId }),
    { method: 'PATCH', body: updates, errorMessage: 'Failed to update contact.' },
  )
}

export async function deleteContact(projectId: string, contactId: string) {
  return fetchApiRaw(buildUrl(paths.detail(contactId), { projectId }), { method: 'DELETE' })
}

export async function archiveContact(projectId: string, contactId: string, isArchived: boolean) {
  return fetchApiRaw(buildUrl(paths.archive(contactId), { projectId }), {
    method: 'PATCH',
    body: { is_archived: isArchived },
  })
}

export async function listContactSessions(projectId: string, contactId: string) {
  return fetchApi<{ sessions: ContactLinkedSession[] }>(
    buildUrl(paths.sessions(contactId), { projectId }),
    { errorMessage: 'Failed to load contact sessions.' },
  )
}

export async function listContactIssues(projectId: string, contactId: string) {
  return fetchApi<{ issues: ContactLinkedIssue[] }>(
    buildUrl(paths.issues(contactId), { projectId }),
    { errorMessage: 'Failed to load contact issues.' },
  )
}
