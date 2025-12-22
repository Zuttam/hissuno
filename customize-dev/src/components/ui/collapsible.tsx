'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils/class'

export interface CollapsibleProps {
  /** Whether the collapsible is open (controlled) */
  open?: boolean
  /** Callback when open state changes (controlled) */
  onOpenChange?: (open: boolean) => void
  /** Default open state (uncontrolled) */
  defaultOpen?: boolean
  /** The trigger element that toggles the collapsible */
  trigger: ReactNode
  /** Content to render in the header row alongside the trigger */
  headerActions?: ReactNode
  /** The collapsible content */
  children: ReactNode
  /** Additional class name for the container */
  className?: string
}

export function Collapsible({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  trigger,
  headerActions,
  children,
  className,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const handleToggle = () => {
    const newValue = !isOpen
    if (!isControlled) {
      setInternalOpen(newValue)
    }
    onOpenChange?.(newValue)
  }

  return (
    <div className={cn('', className)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)] transition"
          aria-expanded={isOpen}
        >
          <svg
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isOpen && 'rotate-90'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {trigger}
        </button>
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </div>
      {isOpen && <div className="mt-3">{children}</div>}
    </div>
  )
}




