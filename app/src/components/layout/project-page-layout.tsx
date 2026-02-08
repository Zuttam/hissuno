'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useProject } from '@/components/providers/project-provider'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationCenter } from '@/components/layout/notification-center'
import { AppHeader, type HeaderAlert } from './app-header'

interface ProjectPageLayoutProps {
  children: React.ReactNode
}

export function ProjectPageLayout({ children }: ProjectPageLayoutProps) {
  const { project, projectId } = useProject()
  const { notifications, dismiss } = useNotifications({ projectId: projectId ?? undefined })

  const alerts = useMemo(() => {
    return notifications.map((n): HeaderAlert => {
      const meta = n.metadata as Record<string, unknown> | null
      const message = (meta?.message as string) ?? ''
      const link = meta?.link as string | undefined
      const priority = ((meta?.priority as string) ?? 'low') as HeaderAlert['priority']

      return {
        id: n.id,
        priority,
        message: link ? (
          <>
            {message.replace(/\.$/, '')}.{' '}
            <Link
              href={link}
              className="underline underline-offset-2 hover:text-[var(--accent-warning)]"
            >
              Go to settings
            </Link>
          </>
        ) : (
          message
        ),
        onDismiss: () => dismiss(n.id),
      }
    })
  }, [notifications, dismiss])

  return (
    <div className="flex flex-col h-full gap-6">
      <AppHeader
        title={project?.name || 'Untitled Project'}
        description={project?.description || undefined}
        alerts={alerts}
        actions={<NotificationCenter projectId={projectId ?? undefined} />}
      />

      {/* Page content */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto overflow-x-hidden mx-4 md:mx-6 pb-6">
        {children}
      </div>
    </div>
  )
}
