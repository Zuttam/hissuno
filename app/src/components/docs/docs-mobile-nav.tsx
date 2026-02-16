'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/class'
import { DOCS_NAV } from '@/app/(marketing)/docs/_config/docs-nav'

export function DocsMobileNav() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const currentPage = DOCS_NAV.flatMap((cat) => cat.items).find((item) => item.href === pathname)
  const currentTitle = currentPage?.title || 'Documentation'

  return (
    <div className="sticky top-16 z-30 lg:hidden">
      <div className="flex items-center border-b border-[color:var(--border-subtle)] bg-[color:var(--background)]/95 backdrop-blur-sm px-4 py-2.5">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm font-mono text-[color:var(--foreground)]"
          aria-expanded={isOpen}
          aria-label="Toggle documentation navigation"
        >
          <svg
            className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {currentTitle}
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-[color:var(--background)] border-r border-[color:var(--border-subtle)] p-4 pt-20">
            <nav className="space-y-5" aria-label="Documentation navigation">
              {DOCS_NAV.map((category) => (
                <div key={category.slug}>
                  <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                    {category.title}
                  </p>
                  <ul className="space-y-0.5">
                    {category.items.map((item) => {
                      const isActive = pathname === item.href

                      return (
                        <li key={item.slug}>
                          <Link
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              'block rounded-[4px] py-1.5 pl-3 text-sm transition',
                              isActive
                                ? 'border-l-2 border-[color:var(--accent-teal)] text-[color:var(--accent-teal)] font-medium'
                                : 'border-l-2 border-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)]'
                            )}
                          >
                            {item.title}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
