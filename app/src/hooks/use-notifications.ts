'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

interface NotificationRecord {
  id: string
  type: string
  channel: string
  metadata: Record<string, unknown> | null
  sent_at: string
  dismissed_at: string | null
  project_id: string | null
}

interface UseNotificationsOptions {
  projectId?: string
}

interface UseNotificationsState {
  notifications: NotificationRecord[]
  isLoading: boolean
  error: string | null
  unreadCount: number
  dismiss: (id: string) => void
  refresh: () => Promise<void>
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsState {
  const { projectId } = options
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (projectId) params.set('projectId', projectId)
      const url = `/api/notifications/inbox${params.toString() ? `?${params}` : ''}`
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load notifications.')
      }
      const payload = await response.json()
      setNotifications(payload.notifications ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading notifications.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  const dismiss = useCallback(
    (id: string) => {
      // Optimistic removal
      setNotifications((prev) => prev.filter((n) => n.id !== id))

      void fetch(`/api/notifications/${id}/dismiss`, { method: 'POST' }).catch((err) => {
        console.error('[use-notifications] Failed to dismiss notification:', err)
        // Refresh to restore state on failure
        void fetchNotifications()
      })
    },
    [fetchNotifications]
  )

  return useMemo(
    () => ({
      notifications,
      isLoading,
      error,
      unreadCount: notifications.length,
      dismiss,
      refresh: fetchNotifications,
    }),
    [notifications, isLoading, error, dismiss, fetchNotifications]
  )
}
