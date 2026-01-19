'use client'

import { forwardRef } from 'react'

interface MenuIconProps {
  isOpen?: boolean
  className?: string
}

const MenuIcon = forwardRef<SVGSVGElement, MenuIconProps>(
  ({ isOpen = false, className = '' }, ref) => {
    return (
      <svg
        ref={ref}
        className={className}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isOpen ? (
          <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </>
        ) : (
          <>
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </>
        )}
      </svg>
    )
  }
)
MenuIcon.displayName = 'MenuIcon'

export { MenuIcon }
