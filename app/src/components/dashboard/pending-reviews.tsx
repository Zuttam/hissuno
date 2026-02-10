'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { SESSION_SOURCE_INFO } from '@/types/session'
import type { PendingReviewSession } from '@/types/dashboard'

interface PendingReviewsProps {
  sessions: PendingReviewSession[]
  count: number
  projectId: string
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getDisplayName(session: PendingReviewSession): string {
  if (session.name) return session.name
  const metaName = session.user_metadata?.name
  if (metaName) return metaName
  const metaEmail = session.user_metadata?.email
  if (metaEmail) return metaEmail
  if (session.user_id) return session.user_id
  return 'Anonymous feedback'
}

export function PendingReviews({ sessions, count, projectId }: PendingReviewsProps) {
  const router = useRouter()

  const sourceInfo = (source: string) =>
    SESSION_SOURCE_INFO[source as keyof typeof SESSION_SOURCE_INFO] ?? { label: source, variant: 'default' as const }

  return (
    <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3">
      <div className="mb-3 flex items-center gap-2">
        <h4 className="font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)]">
          Pending Reviews
        </h4>
        {count > 0 && (
          <Badge variant="warning">{count}</Badge>
        )}
      </div>
      {sessions.length === 0 ? (
        <div className="flex h-[120px] items-center justify-center text-xs text-[color:var(--text-secondary)]">
          All caught up!
        </div>
      ) : (
        <div className="space-y-1.5">
          {sessions.map((session) => {
            const info = sourceInfo(session.source)
            return (
              <button
                key={session.id}
                onClick={() => router.push(`/projects/${projectId}/sessions/${session.id}`)}
                className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--surface-hover)]"
              >
                <span className="flex-1 truncate font-mono text-xs text-[color:var(--foreground)]">
                  {getDisplayName(session)}
                </span>
                <Badge variant={info.variant}>{info.label}</Badge>
                <span className="whitespace-nowrap font-mono text-[10px] text-[color:var(--text-secondary)]">
                  {timeAgo(session.created_at)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
