'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils/class'

export function AppHeader({ children }: { children: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed left-0 right-0 top-0 mx-auto px-4 py-0.5 transition-all duration-300',
        'z-10',
        // Liquid glass effect
        'bg-[var(--background)]/40 backdrop-blur-xl backdrop-saturate-150',
        // Subtle bottom border
        'border-b border-[var(--border-subtle)]/50',
        // Soft shadow for depth/pop
        'shadow-[0_1px_4px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]',
        'dark:shadow-[0_1px_4px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.25)]'
      )}
    >
      {/* Inner glow/highlight line for glass edge effect */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)]/40 to-transparent" />
      {children}
    </header>
  )
}
