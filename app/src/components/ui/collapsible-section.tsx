'use client'

import { forwardRef, useState } from 'react'

type CollapsibleSectionVariant = 'default' | 'flat'

interface CollapsibleSectionProps {
  title: string
  collapsedSummary?: string
  defaultExpanded?: boolean
  variant?: CollapsibleSectionVariant
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<CollapsibleSectionVariant, { container: string; content: string }> = {
  default: {
    container: 'rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)]',
    content: 'border-t border-[color:var(--border-subtle)] p-4',
  },
  flat: {
    container: '',
    content: 'pt-4',
  },
}

const CollapsibleSection = forwardRef<HTMLDivElement, CollapsibleSectionProps>(
  ({ title, collapsedSummary, defaultExpanded = true, variant = 'default', children, className = '' }, ref) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)
    const styles = variantStyles[variant]

    return (
      <div ref={ref} className={`${styles.container} ${className}`}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex w-full items-center justify-between text-left ${variant === 'default' ? 'p-3' : 'pb-0'}`}
        >
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">
              {title}
            </span>
            {!isExpanded && collapsedSummary && (
              <span className="font-mono text-sm text-[color:var(--foreground)]">
                {collapsedSummary}
              </span>
            )}
          </div>
          <svg
            className={`h-4 w-4 text-[color:var(--text-secondary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className={styles.content}>
            {children}
          </div>
        )}
      </div>
    )
  }
)
CollapsibleSection.displayName = 'CollapsibleSection'

export { CollapsibleSection }
