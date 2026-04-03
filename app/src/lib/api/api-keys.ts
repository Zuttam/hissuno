import { fetchApi, buildUrl } from './fetch'
import type { ApiKeyRecord } from '@/types/project-members'

const paths = {
  apiKeys: '/api/settings/api-keys',
  apiKey: (keyId: string) => `/api/settings/api-keys/${keyId}`,
}

export async function listApiKeys(projectId: string): Promise<ApiKeyRecord[]> {
  const url = buildUrl(paths.apiKeys, { projectId })
  const { apiKeys } = await fetchApi<{ apiKeys: ApiKeyRecord[] }>(url, {
    errorMessage: 'Failed to load API keys.',
  })
  return apiKeys ?? []
}

export async function createApiKey(projectId: string, body: Record<string, string>) {
  const url = buildUrl(paths.apiKeys, { projectId })
  return fetchApi<{ fullKey: string }>(url, {
    method: 'POST',
    body,
    errorMessage: 'Failed to create API key.',
  })
}

export async function revokeApiKey(projectId: string, keyId: string) {
  const url = buildUrl(paths.apiKey(keyId), { projectId })
  return fetchApi<void>(url, {
    method: 'DELETE',
    errorMessage: 'Failed to revoke API key.',
  })
}
