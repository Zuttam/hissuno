import { fetchApi, buildUrl } from './fetch'

export interface CodebaseRecord {
  id: string
  project_id: string
  user_id: string | null
  repository_url: string | null
  repository_branch: string | null
  commit_sha: string | null
  kind: string
  name: string | null
  description: string | null
  enabled: boolean
  analysis_scope: string | null
  synced_at: string | null
  created_at: string
  updated_at: string
}

const paths = {
  list: '/api/codebases',
  detail: (id: string) => `/api/codebases/${id}`,
  sync: (id: string) => `/api/codebases/${id}/sync`,
}

export async function listCodebases(projectId: string): Promise<CodebaseRecord[]> {
  const { codebases } = await fetchApi<{ codebases: CodebaseRecord[] }>(
    buildUrl(paths.list, { projectId }),
    { errorMessage: 'Failed to load codebases.' },
  )
  return codebases ?? []
}

export interface CreateCodebaseInput {
  repository_url: string
  repository_branch: string
  name?: string | null
  description?: string | null
  analysis_scope?: string | null
}

export async function createCodebase(
  projectId: string,
  input: CreateCodebaseInput,
): Promise<CodebaseRecord> {
  const { codebase } = await fetchApi<{ codebase: CodebaseRecord }>(
    buildUrl(paths.list, { projectId }),
    {
      method: 'POST',
      body: input,
      errorMessage: 'Failed to create codebase.',
    },
  )
  return codebase
}

export interface UpdateCodebaseInput {
  repository_url?: string
  repository_branch?: string
  name?: string | null
  description?: string | null
  enabled?: boolean
  analysis_scope?: string | null
}

export async function updateCodebase(
  projectId: string,
  codebaseId: string,
  input: UpdateCodebaseInput,
): Promise<CodebaseRecord> {
  const { codebase } = await fetchApi<{ codebase: CodebaseRecord }>(
    buildUrl(paths.detail(codebaseId), { projectId }),
    {
      method: 'PATCH',
      body: input,
      errorMessage: 'Failed to update codebase.',
    },
  )
  return codebase
}

export async function deleteCodebase(projectId: string, codebaseId: string): Promise<void> {
  await fetchApi<{ success: true }>(
    buildUrl(paths.detail(codebaseId), { projectId }),
    {
      method: 'DELETE',
      errorMessage: 'Failed to delete codebase.',
    },
  )
}

export async function syncCodebase(projectId: string, codebaseId: string): Promise<void> {
  await fetchApi<{ result: unknown }>(
    buildUrl(paths.sync(codebaseId), { projectId }),
    {
      method: 'POST',
      errorMessage: 'Failed to sync codebase.',
    },
  )
}
