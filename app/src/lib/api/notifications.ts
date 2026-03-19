import { fetchApi, fetchApiRaw, buildUrl } from './fetch'

const paths = {
  inbox: '/api/notifications/inbox',
  dismiss: (id: string) => `/api/notifications/${id}/dismiss`,
}

export interface NotificationRecord {
  id: string
  type: string
  channel: string
  metadata: Record<string, unknown> | null
  sent_at: string
  dismissed_at: string | null
  project_id: string | null
}

export async function listNotifications(projectId?: string): Promise<NotificationRecord[]> {
  const url = buildUrl(paths.inbox, { projectId })
  const { notifications } = await fetchApi<{ notifications: NotificationRecord[] }>(url, {
    errorMessage: 'Failed to load notifications.',
  })
  return notifications ?? []
}

export function dismissNotification(id: string): Promise<Response> {
  return fetchApiRaw(paths.dismiss(id), { method: 'POST' })
}
