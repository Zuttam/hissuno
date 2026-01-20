'use client'

import { forwardRef, type ReactNode } from 'react'
import { Heading } from './heading'
import { IconButton } from './icon-button'
import { RefreshIcon } from './refresh-icon'

interface PageHeaderProps {
  title: string
  onRefresh?: () => void
  actions?: ReactNode
  className?: string
}

const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(
  ({ title, onRefresh, actions, className = '' }, ref) => {
    return (
      <header ref={ref} className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
        <div className="flex items-center gap-3">
          <Heading as="h1" size="page">
            {title}
          </Heading>
          {onRefresh && (
            <IconButton
              aria-label={`Refresh ${title.toLowerCase()}`}
              variant="ghost"
              size="md"
              onClick={onRefresh}
            >
              <RefreshIcon />
            </IconButton>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </header>
    )
  }
)
PageHeader.displayName = 'PageHeader'

export { PageHeader }
