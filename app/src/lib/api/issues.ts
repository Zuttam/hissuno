import { fetchApi, fetchApiRaw, buildUrl } from './fetch'
import type { IssueWithProject, IssueWithSessions, CreateIssueInput } from '@/types/issue'

const ISSUE_ANALYSIS_SKILL_ID = 'hissuno-issue-analysis'

const paths = {
  list: '/api/issues',
  detail: (i: string) => `/api/issues/${i}`,
  archive: (i: string) => `/api/issues/${i}/archive`,
  batchArchive: '/api/issues/batch/archive',
  sessions: (i: string) => `/api/issues/${i}/sessions`,
  generateBrief: (i: string) => `/api/issues/${i}/generate-brief`,
  generateBriefStream: (i: string) => `/api/issues/${i}/generate-brief/stream`,
  // Automation runner — replaces /api/issues/<id>/analyze* endpoints.
  automationRun: (skillId: string) => `/api/automations/${skillId}/run`,
  automationStream: (runId: string) => `/api/automations/runs/${runId}/stream`,
}

export interface IssueListParams {
  type?: string
  priority?: string
  status?: string
  search?: string
  showArchived?: boolean
  reachLevel?: string
  impactLevel?: string
  confidenceLevel?: string
  effortLevel?: string
  productScopeIds?: string
  goalId?: string
  limit?: number
  offset?: number
}

export async function listIssues(projectId: string, params?: IssueListParams) {
  return fetchApi<{ issues: IssueWithProject[]; total: number }>(
    buildUrl(paths.list, { projectId, ...params } as Record<string, string | number | boolean | undefined | null>),
    { errorMessage: 'Failed to load issues.' },
  )
}

export async function getIssue(projectId: string, issueId: string) {
  return fetchApi<{ issue: IssueWithSessions }>(
    buildUrl(paths.detail(issueId), { projectId }),
    { errorMessage: 'Failed to load issue.' },
  )
}

export async function createIssue(projectId: string, input: CreateIssueInput) {
  return fetchApi<{ issue: IssueWithProject }>(
    buildUrl(paths.list, { projectId }),
    { method: 'POST', body: input, errorMessage: 'Failed to create issue.' },
  )
}

export async function updateIssue(projectId: string, issueId: string, updates: Partial<IssueWithSessions>) {
  return fetchApi<{ issue: IssueWithSessions }>(
    buildUrl(paths.detail(issueId), { projectId }),
    { method: 'PATCH', body: updates, errorMessage: 'Failed to update issue.' },
  )
}

export async function deleteIssue(projectId: string, issueId: string) {
  return fetchApiRaw(buildUrl(paths.detail(issueId), { projectId }), { method: 'DELETE' })
}

export async function archiveIssue(projectId: string, issueId: string, isArchived: boolean) {
  return fetchApiRaw(buildUrl(paths.archive(issueId), { projectId }), {
    method: 'PATCH',
    body: { is_archived: isArchived },
  })
}

export async function batchArchiveIssues(projectId: string, issueIds: string[], isArchived: boolean) {
  return fetchApiRaw(buildUrl(paths.batchArchive, { projectId }), {
    method: 'POST',
    body: { issueIds, is_archived: isArchived },
  })
}

export async function linkSession(projectId: string, issueId: string, sessionId: string) {
  return fetchApiRaw(buildUrl(paths.sessions(issueId), { projectId }), {
    method: 'POST',
    body: { session_id: sessionId },
  })
}

export async function unlinkSession(projectId: string, issueId: string, sessionId: string) {
  return fetchApiRaw(buildUrl(paths.sessions(issueId), { projectId }), {
    method: 'DELETE',
    body: { session_id: sessionId },
  })
}

/**
 * Start an issue-analysis automation run. The agent runs in the background;
 * use `issueAnalyzeStreamUrl(projectId, runId)` to watch progress.
 */
export async function startAnalysis(projectId: string, issueId: string, opts?: { signal?: AbortSignal }) {
  return fetchApi<{ runId: string; streamUrl: string }>(
    buildUrl(paths.automationRun(ISSUE_ANALYSIS_SKILL_ID), { projectId }),
    {
      method: 'POST',
      body: { entity: { type: 'issue', id: issueId } },
      errorMessage: 'Failed to start analysis',
      signal: opts?.signal,
    },
  )
}

/**
 * Run cancellation. Server marks the row cancelled; the in-process agent
 * continues to its next checkpoint and observes the status, but the SSE
 * client closes immediately.
 */
export async function cancelAnalysis(_projectId: string, _issueId: string) {
  // Cancellation isn't wired through the new automation_runs lifecycle yet.
  // Returning a no-op keeps callers compiling; UI hides the cancel affordance.
  return { ok: true } as const
}

export function issueAnalyzeStreamUrl(projectId: string, _issueId: string, runId: string): string {
  return buildUrl(paths.automationStream(runId), { projectId })
}

export async function generateBrief(projectId: string, issueId: string, opts?: { signal?: AbortSignal }) {
  return fetchApi<{ runId: string }>(
    buildUrl(paths.generateBrief(issueId), { projectId }),
    { method: 'POST', errorMessage: 'Failed to start brief generation', signal: opts?.signal },
  )
}

export function generateBriefStreamUrl(projectId: string, issueId: string, runId: string): string {
  return buildUrl(paths.generateBriefStream(issueId), { projectId, runId })
}
