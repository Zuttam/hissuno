'use client'

import { forwardRef, useEffect, useState } from 'react'

type CollapsibleSectionVariant = 'default' | 'flat'

interface CollapsibleSectionProps {
  title: string
  collapsedSummary?: string
  /** Content to show below the header when collapsed (e.g., quick filters) */
  collapsedContent?: React.ReactNode
  /** Content rendered on the right side of the header row (e.g., action buttons) */
  headerRight?: React.ReactNode
  defaultExpanded?: boolean
  /** When set to true, forces the section to expand (one-way signal) */
  expanded?: boolean
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
  ({ title, collapsedSummary, collapsedContent, headerRight, defaultExpanded = true, expanded, variant = 'default', children, className = '' }, ref) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)
    const styles = variantStyles[variant]

    // Allow external force-expansion
    useEffect(() => {
      if (expanded) {
        setIsExpanded(true)
      }
    }, [expanded])

    return (
      <div ref={ref} className={`${styles.container} ${className}`}>
        <div className={`flex w-full items-center gap-2 ${variant === 'default' ? 'p-3' : 'pb-0'}`}>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex flex-1 items-center justify-between text-left"
          >
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">
                {title}
              </span>
              {!isExpanded && collapsedSummary && (
                <span className="font-mono text-xs text-[color:var(--foreground)]">
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
          {headerRight && (
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              {headerRight}
            </div>
          )}
        </div>

        {isExpanded ? (
          <div className={styles.content}>
            {children}
          </div>
        ) : (
          collapsedContent && (
            <div className={variant === 'default' ? 'px-3 pb-3' : 'pt-2'}>
              {collapsedContent}
            </div>
          )
        )}
      </div>
    )
  }
)
CollapsibleSection.displayName = 'CollapsibleSection'

export { CollapsibleSection }
