import type { SessionWithProject, SessionFilters, CreateSessionInput, UpdateSessionInput, ChatMessage } from '@/types/session'
import type { SessionReviewStatusResponse } from '@/hooks/use-session-review'
import { buildUrl, fetchApi, fetchApiRaw } from './fetch'

const paths = {
  list: '/api/sessions',
  detail: (sessionId: string) => `/api/sessions/${sessionId}`,
  archive: (sessionId: string) => `/api/sessions/${sessionId}/archive`,
  batchArchive: '/api/sessions/batch/archive',
  batchSetCustomer: '/api/sessions/batch/set-customer',
  review: (sessionId: string) => `/api/sessions/${sessionId}/review`,
  reviewStream: (sessionId: string) => `/api/sessions/${sessionId}/review/stream`,
  tags: (sessionId: string) => `/api/sessions/${sessionId}/tags`,
  messages: (sessionId: string) => `/api/sessions/${sessionId}/messages`,
}

interface ListSessionsResponse {
  sessions: SessionWithProject[]
  total: number
}

export async function listSessions(
  projectId: string,
  filters?: Omit<SessionFilters, 'projectId'>,
): Promise<ListSessionsResponse> {
  const url = buildUrl(paths.list, {
    projectId,
    sessionId: filters?.sessionId,
    name: filters?.name,
    search: filters?.search,
    status: filters?.status,
    source: filters?.source,
    tags: filters?.tags && filters.tags.length > 0 ? filters.tags.join(',') : undefined,
    dateFrom: filters?.dateFrom,
    dateTo: filters?.dateTo,
    showArchived: filters?.showArchived ? 'true' : undefined,
    isHumanTakeover: filters?.isHumanTakeover ? 'true' : undefined,
    isAnalyzed: filters?.isAnalyzed ? 'true' : undefined,
    companyId: filters?.companyId,
    contactId: filters?.contactId,
    productScopeIds: filters?.productScopeIds && filters.productScopeIds.length > 0 ? filters.productScopeIds.join(',') : undefined,
    limit: filters?.limit,
    offset: filters?.offset,
  })
  return fetchApi<ListSessionsResponse>(url, { errorMessage: 'Failed to load sessions.' })
}

interface GetSessionResponse {
  session: SessionWithProject
  messages: ChatMessage[]
}

export async function getSession(projectId: string, sessionId: string): Promise<GetSessionResponse> {
  return fetchApi<GetSessionResponse>(buildUrl(paths.detail(sessionId), { projectId }), { errorMessage: 'Failed to load session.' })
}

interface CreateSessionResponse {
  session: SessionWithProject
}

export async function createSession(projectId: string, input: CreateSessionInput): Promise<CreateSessionResponse> {
  return fetchApi<CreateSessionResponse>(buildUrl(paths.list, { projectId }), {
    method: 'POST',
    body: input,
    errorMessage: 'Failed to create session.',
  })
}

interface UpdateSessionResponse {
  session: SessionWithProject
}

export async function updateSession(projectId: string, sessionId: string, input: UpdateSessionInput): Promise<UpdateSessionResponse> {
  return fetchApi<UpdateSessionResponse>(buildUrl(paths.detail(sessionId), { projectId }), {
    method: 'PATCH',
    body: input,
    errorMessage: 'Failed to update session.',
  })
}

export async function archiveSession(projectId: string, sessionId: string, isArchived: boolean): Promise<void> {
  await fetchApi(buildUrl(paths.archive(sessionId), { projectId }), {
    method: 'PATCH',
    body: { is_archived: isArchived },
    errorMessage: 'Failed to archive session.',
  })
}

export async function batchArchiveSessions(projectId: string, sessionIds: string[], isArchived: boolean): Promise<void> {
  await fetchApi(buildUrl(paths.batchArchive, { projectId }), {
    method: 'POST',
    body: { sessionIds, is_archived: isArchived },
    errorMessage: 'Failed to batch archive sessions.',
  })
}

interface BatchSetCustomerResponse {
  success: boolean
  error?: string
}

export async function batchSetCustomer(projectId: string, sessionIds: string[], contactId: string | null): Promise<BatchSetCustomerResponse> {
  return fetchApi<BatchSetCustomerResponse>(buildUrl(paths.batchSetCustomer, { projectId }), {
    method: 'POST',
    body: { sessionIds, contactId },
    errorMessage: 'Failed to set customer.',
  })
}

export async function getSessionReviewStatus(projectId: string, sessionId: string): Promise<SessionReviewStatusResponse> {
  return fetchApi<SessionReviewStatusResponse>(buildUrl(paths.review(sessionId), { projectId }), { errorMessage: 'Failed to fetch review status.' })
}

export async function triggerSessionReview(projectId: string, sessionId: string, signal?: AbortSignal): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.review(sessionId), { projectId }), { method: 'POST', signal })
}

export function sessionReviewStreamUrl(projectId: string, sessionId: string): string {
  return buildUrl(paths.reviewStream(sessionId), { projectId })
}

export async function updateSessionTags(projectId: string, sessionId: string, tags: string[]): Promise<void> {
  await fetchApi(buildUrl(paths.tags(sessionId), { projectId }), {
    method: 'PATCH',
    body: { tags },
    errorMessage: 'Failed to update tags.',
  })
}

interface SendMessageResponse {
  message: ChatMessage
}

export async function sendMessage(projectId: string, sessionId: string, content: string): Promise<SendMessageResponse> {
  return fetchApi<SendMessageResponse>(buildUrl(paths.messages(sessionId), { projectId }), {
    method: 'POST',
    body: { content },
    errorMessage: 'Failed to send message',
  })
}
