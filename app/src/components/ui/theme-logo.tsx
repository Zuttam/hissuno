'use client'

import Image from 'next/image'

interface ThemeLogoProps {
  width?: number
  height?: number
  priority?: boolean
  className?: string
}

/**
 * Theme-aware logo component that displays the appropriate logo based on dark/light mode.
 * Uses CSS classes to switch between logos without hydration issues.
 */
export function ThemeLogo({ width = 120, height = 40, priority = false, className = '' }: ThemeLogoProps) {
  return (
    <>
      {/* Light mode logo - hidden in dark mode */}
      <Image
        src="/logos/hissuno/light-mode-transparant.png"
        alt="Hissuno"
        width={width}
        height={height}
        priority={priority}
        className={`dark:hidden ${className}`}
      />
      {/* Dark mode logo - hidden in light mode */}
      <Image
        src="/logos/hissuno/dark-mode-transparant.png"
        alt="Hissuno"
        width={width}
        height={height}
        priority={priority}
        className={`hidden dark:block ${className}`}
      />
    </>
  )
}
