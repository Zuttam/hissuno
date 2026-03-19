import { fetchApi, buildUrl } from './fetch'
import type { ProjectMemberWithProfile } from '@/types/project-members'

const paths = {
  members: '/api/members',
  member: (memberId: string) => `/api/members/${memberId}`,
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function listMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
  const url = buildUrl(paths.members, { projectId })
  const { members } = await fetchApi<{ members: ProjectMemberWithProfile[] }>(url, {
    errorMessage: 'Failed to load members.',
  })
  return members ?? []
}

export async function inviteMember(projectId: string, email: string, role = 'member') {
  const url = buildUrl(paths.members, { projectId })
  return fetchApi<Record<string, unknown>>(url, {
    method: 'POST',
    body: { email, role },
    errorMessage: 'Failed to invite member.',
  })
}

export async function removeMember(projectId: string, memberId: string) {
  const url = buildUrl(paths.member(memberId), { projectId })
  return fetchApi<void>(url, {
    method: 'DELETE',
    errorMessage: 'Failed to remove member.',
  })
}

export async function updateMemberRole(projectId: string, memberId: string, role: string) {
  const url = buildUrl(paths.member(memberId), { projectId })
  return fetchApi<Record<string, unknown>>(url, {
    method: 'PATCH',
    body: { role },
    errorMessage: 'Failed to update member role.',
  })
}

