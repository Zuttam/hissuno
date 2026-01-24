'use client'

import Link from 'next/link'
import { Dialog } from '@/components/ui'
import { Button } from '@/components/ui'

type LimitDimension = 'projects' | 'analyzed_sessions'

const dimensionConfig: Record<LimitDimension, { title: string; description: string }> = {
  projects: {
    title: 'Project limit reached',
    description: "You've reached the maximum number of projects for your current plan.",
  },
  analyzed_sessions: {
    title: 'Session analysis limit reached',
    description: "You've used all your session analyses for this billing period.",
  },
}

interface LimitReachedDialogProps {
  open: boolean
  onClose: () => void
  current: number
  limit: number
  upgradeUrl: string
  dimension?: LimitDimension
}

export function LimitReachedDialog({
  open,
  onClose,
  current,
  limit,
  upgradeUrl,
  dimension = 'analyzed_sessions',
}: LimitReachedDialogProps) {
  const config = dimensionConfig[dimension]
  const unitLabel = dimension === 'projects' ? 'projects' : 'sessions analyzed'

  return (
    <Dialog open={open} onClose={onClose} title="Limit Reached">
      <div className="space-y-4">
        <div className="rounded-[4px] border border-[var(--accent-warning)]/30 bg-[var(--accent-warning)]/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-warning)]/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--accent-warning)]"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-[var(--foreground)]">
                {config.title}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {config.description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-[4px] bg-[var(--surface)] p-4">
          <span className="font-mono text-2xl font-bold text-[var(--foreground)]">
            {current}
          </span>
          <span className="text-[var(--text-tertiary)]">/</span>
          <span className="font-mono text-2xl font-bold text-[var(--text-secondary)]">
            {limit}
          </span>
          <span className="ml-2 text-sm text-[var(--text-secondary)]">
            {unitLabel}
          </span>
        </div>

        <p className="text-sm text-[var(--text-secondary)]">
          Upgrade your plan to continue and get more from Hissuno.
        </p>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Maybe Later
          </Button>
          <Link href={upgradeUrl} className="flex-1">
            <Button
              variant="primary"
              className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
              onClick={onClose}
            >
              Upgrade Plan
            </Button>
          </Link>
        </div>
      </div>
    </Dialog>
  )
}
