import { useRef, useState, useEffect } from "react"
import { Divider, Text } from "@/components/ui"

export type AlertPriority = 'high' | 'medium' | 'low'

export interface HeaderAlert {
  id: string
  priority: AlertPriority
  message: React.ReactNode
  onDismiss?: () => void
}

interface AppHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  alerts?: HeaderAlert[]
}

const priorityConfig: Record<AlertPriority, { iconColor: string; borderColor: string }> = {
  high: {
    iconColor: 'text-[var(--accent-danger)]',
    borderColor: 'border-[var(--accent-danger)]/30',
  },
  medium: {
    iconColor: 'text-[var(--accent-warning)]',
    borderColor: 'border-[var(--accent-warning)]/30',
  },
  low: {
    iconColor: 'text-[var(--accent-info)]',
    borderColor: 'border-[var(--accent-info)]/30',
  },
}

function PriorityIcon({ priority }: { priority: AlertPriority }) {
  const { iconColor } = priorityConfig[priority]

  if (priority === 'high') {
    return (
      <svg className={`h-4 w-4 flex-shrink-0 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  }

  if (priority === 'medium') {
    return (
      <svg className={`h-4 w-4 flex-shrink-0 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  // low
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export function AppHeader({
  title,
  description,
  actions,
  alerts,
}: AppHeaderProps) {
  const visibleAlerts = alerts?.filter(Boolean) ?? []
  const descriptionRef = useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  useEffect(() => {
    const el = descriptionRef.current
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth)
    }
  }, [description])

  return (
    <header className="flex flex-col py-4 pr-4 pl-16 md:px-6 border-b border-[color:var(--border-subtle)] backdrop-blur-xl bg-[color:var(--background)]/80 relative z-10">
      <div className="flex items-center justify-between gap-4">
        {/* Left side: Project name / Page title */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            {title}
          </span>
          <span className="text-[color:var(--text-tertiary)]">/</span>
          {description && (
            <span
              ref={descriptionRef}
              title={isTruncated ? description : undefined}
              className="hidden md:inline text-sm text-[color:var(--text-tertiary)] truncate max-w-xl"
            >
              {description}
            </span>
          )}
        </div>

        {/* Right side: Actions */}
        {(actions) && (
          <div className="flex flex-shrink-0 items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {/* Alert rows below header */}
      {visibleAlerts.length > 0 && (
      <div className="flex flex-col"> 
        <Divider className="my-0" />
        <div className="flex flex-col gap-4"> 
          <Text className="text-sm font-mono text-[var(--text-secondary)]">
            System Alerts
          </Text>
          {visibleAlerts.map((alert) => {
            const config = priorityConfig[alert.priority]
            return (
              <div
                key={alert.id}
                className={`flex items-center gap-3 text-sm font-mono text-[var(--text-secondary)]`}
              >
                <PriorityIcon priority={alert.priority} />
                <span className="flex-1 min-w-0">{alert.message}</span>
                {alert.onDismiss && (
                  <button
                    type="button"
                    onClick={alert.onDismiss}
                    className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    aria-label="Dismiss"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
          </div>
      </div>
      )}
   </header>
  )
}
