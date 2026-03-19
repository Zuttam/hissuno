import { fetchApi, fetchApiRaw } from './fetch'

const paths = {
  list: '/api/projects',
  detail: (projectId: string) => `/api/projects/${projectId}`,
  demo: '/api/projects/demo',
  membersAccept: '/api/projects/members/accept',
}

export async function listProjects<T = unknown>(): Promise<T> {
  return fetchApi<T>(paths.list, {
    errorMessage: 'Failed to load projects.',
  })
}

export async function fetchProject<T = unknown>(projectId: string): Promise<T> {
  return fetchApi<T>(paths.detail(projectId), {
    errorMessage: 'Failed to load project.',
  })
}

export async function createProject(formData: FormData) {
  return fetchApi<Record<string, unknown>>(paths.list, {
    method: 'POST',
    formData,
    errorMessage: 'Failed to create project.',
  })
}

export async function updateProject(projectId: string, payload: Record<string, unknown>) {
  return fetchApi<Record<string, unknown>>(paths.detail(projectId), {
    method: 'PATCH',
    body: payload,
    errorMessage: 'Failed to update project.',
  })
}

export function createDemoProject(): Promise<Response> {
  return fetchApiRaw(paths.demo, { method: 'POST' })
}

export function acceptMemberInvite(memberId: string): Promise<Response> {
  return fetchApiRaw(paths.membersAccept, {
    method: 'POST',
    body: { memberId },
  })
}

export async function deleteProject(projectId: string) {
  return fetchApi<void>(paths.detail(projectId), {
    method: 'DELETE',
    errorMessage: 'Failed to delete project.',
  })
}
