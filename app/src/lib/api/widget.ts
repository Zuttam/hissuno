/**
 * Client helpers for the widget — the only hissuno integration that lives
 * outside the plugin-kit (it has its own table + UI).
 */

import { fetchApi } from './fetch'

export function fetchWidgetSettings<T = unknown>(projectId: string): Promise<T> {
  return fetchApi<T>(`/api/integrations/widget?projectId=${encodeURIComponent(projectId)}`, {
    errorMessage: 'Failed to fetch widget settings',
  })
}

export function updateWidgetSettings<T = unknown>(projectId: string, body: unknown): Promise<T> {
  return fetchApi<T>(`/api/integrations/widget?projectId=${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    errorMessage: 'Failed to update widget settings',
  })
}
