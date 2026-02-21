'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useNotifications } from '@/hooks/use-notifications'

interface NotificationCenterProps {
  projectId?: string
}

const priorityColors: Record<string, string> = {
  high: 'bg-[var(--accent-danger)]',
  medium: 'bg-[var(--accent-warning)]',
  low: 'bg-[var(--accent-info)]',
}

export function NotificationCenter({ projectId }: NotificationCenterProps) {
  const { notifications, unreadCount, dismiss } = useNotifications({ projectId })
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on escape key and click outside
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center p-1.5 text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)] transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-danger)] px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
            <span className="font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Notifications
            </span>
            <div className="flex items-center gap-2">
              <Link
                href="/account/notifications"
                onClick={() => setIsOpen(false)}
                className="text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-secondary)]"
                aria-label="Notification settings"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </Link>
              {unreadCount > 0 && (
                <span className="text-xs text-[color:var(--text-tertiary)]">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[color:var(--text-tertiary)]">
                All caught up
              </div>
            ) : (
              notifications.map((notification) => {
                const meta = notification.metadata as Record<string, unknown> | null
                const title = (meta?.title as string) ?? notification.type
                const message = (meta?.message as string) ?? ''
                const link = meta?.link as string | undefined
                const priority = (meta?.priority as string) ?? 'low'

                return (
                  <div
                    key={notification.id}
                    className="flex items-start gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3 last:border-b-0"
                  >
                    {/* Priority dot */}
                    <span
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${priorityColors[priority] ?? priorityColors.low}`}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[color:var(--foreground)]">{title}</p>
                      {link ? (
                        <Link
                          href={link}
                          onClick={() => setIsOpen(false)}
                          className="text-xs text-[color:var(--text-secondary)] underline underline-offset-2 hover:text-[color:var(--foreground)]"
                        >
                          {message}
                        </Link>
                      ) : (
                        <p className="text-xs text-[color:var(--text-secondary)]">{message}</p>
                      )}
                    </div>

                    {/* Dismiss button */}
                    <button
                      type="button"
                      onClick={() => dismiss(notification.id)}
                      className="flex-shrink-0 mt-0.5 text-[color:var(--text-tertiary)] hover:text-[color:var(--foreground)] transition-colors"
                      aria-label="Dismiss notification"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
