'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listNotifications, dismissNotification, type NotificationRecord } from '@/lib/api/notifications'

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
      const result = await listNotifications(projectId)
      setNotifications(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading notifications.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    void fetchNotifications()
  }, [fetchNotifications, projectId])

  const dismiss = useCallback(
    (id: string) => {
      // Optimistic removal
      setNotifications((prev) => prev.filter((n) => n.id !== id))

      void dismissNotification(id).catch((err) => {
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
