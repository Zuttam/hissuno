'use client'

import { Button } from '@/components/ui'

interface BatchProgressBarProps {
  label: string
  currentIndex: number
  total: number
  onCancel: () => void
}

export function BatchProgressBar({
  label,
  currentIndex,
  total,
  onCancel,
}: BatchProgressBarProps) {
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0

  return (
    <div className="flex items-center gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0 text-sm font-mono text-[color:var(--foreground)]">
          {label} {currentIndex + 1} of {total}...
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--border-subtle)]">
          <div
            className="h-full rounded-full bg-[color:var(--accent-selected)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
