/**
 * REST API Client
 *
 * Calls the Hissuno REST API directly using the API key.
 */

import type { HissunoConfig } from './config.js'
import { saveConfig } from './config.js'
import { error } from './output.js'

export interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  data: T
}

/**
 * Get the base URL from config.
 */
export function getBaseUrl(config: HissunoConfig): string {
  return config.base_url
}

/**
 * Resolve the project ID from config cache or API.
 * Caches the result back to config on first resolution.
 */
export async function resolveProjectId(config: HissunoConfig): Promise<string> {
  if (config.project_id) return config.project_id

  const result = await apiCall<{ projects: { id: string; name: string }[] }>(config, 'GET', '/api/projects')
  const projects = Array.isArray(result.data) ? result.data : result.data?.projects
  if (!result.ok || !Array.isArray(projects) || projects.length === 0) {
    error('Could not determine project from API key.')
    process.exit(1)
  }

  const projectId = projects[0].id
  config.project_id = projectId
  saveConfig(config)
  return projectId
}

/**
 * Resolve a knowledge scope: if `scopeIdOrSlug` is given, return it as-is
 * (the server validates against the project). Otherwise fetch the project's
 * default product scope.
 */
export async function resolveKnowledgeScope(
  config: HissunoConfig,
  projectId: string,
  scopeIdOrSlug?: string,
): Promise<string> {
  if (scopeIdOrSlug) return scopeIdOrSlug

  const result = await apiCall<{ scopes: Array<{ id: string; is_default?: boolean }> }>(
    config,
    'GET',
    buildPath('/api/product-scopes', { projectId }),
  )
  if (!result.ok) {
    error(`Failed to load product scopes: HTTP ${result.status}`)
    process.exit(1)
  }
  const scopes = result.data?.scopes ?? []
  const defaultScope = scopes.find((s) => s.is_default)
  if (!defaultScope) {
    error('Project has no default product scope. Pass --scope <id> explicitly.')
    process.exit(1)
  }
  return defaultScope.id
}

/**
 * Build an API path with query parameters.
 */
export function buildPath(path: string, params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined
  )
  if (entries.length === 0) return path
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
  return `${path}?${qs}`
}

/**
 * Call a Hissuno REST API route with API key auth.
 */
export async function apiCall<T = unknown>(
  config: HissunoConfig,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const baseUrl = getBaseUrl(config)
  const url = `${baseUrl}${path}`

  const token = config.auth_token ?? config.api_key
  if (!token) {
    return { ok: false, status: 0, data: {} as T }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }

  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = (await response.json().catch(() => ({}))) as T

  return { ok: response.ok, status: response.status, data }
}
