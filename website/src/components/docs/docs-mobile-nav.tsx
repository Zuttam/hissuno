'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/class'
import { DOCS_NAV } from '@/app/docs/_config/docs-nav'
import type { DocNavItem, DocNavSubsection } from '@/app/docs/_config/docs-nav'

function MobileNavItem({
  item,
  pathname,
  onNavigate,
}: {
  item: DocNavItem
  pathname: string
  onNavigate: () => void
}) {
  const isActive = pathname === item.href

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
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
}

function MobileSubsectionNav({
  sub,
  pathname,
  onNavigate,
}: {
  sub: DocNavSubsection
  pathname: string
  onNavigate: () => void
}) {
  const isSubActive = sub.items.some((item) => pathname === item.href)
  const [isOpen, setIsOpen] = useState(isSubActive)

  return (
    <div className="mt-2">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex shrink-0 items-center p-1 text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)] transition"
          aria-expanded={isOpen}
          aria-label={`Toggle ${sub.title}`}
        >
          <svg
            className={cn('h-3 w-3 transition-transform duration-200', isOpen && 'rotate-90')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <Link
          href={sub.href}
          onClick={onNavigate}
          className={cn(
            'block rounded-[4px] py-1.5 pl-1 text-sm font-medium transition',
            isSubActive
              ? 'text-[color:var(--foreground)]'
              : 'text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)]'
          )}
        >
          {sub.title}
        </Link>
      </div>
      {isOpen && (
        <ul className="ml-2 space-y-0.5">
          {sub.items.map((item) => (
            <MobileNavItem
              key={item.slug}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export function DocsMobileNav() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const allItems = DOCS_NAV.flatMap((cat) => [
    ...cat.items,
    ...(cat.subsections?.flatMap((sub) => sub.items) ?? []),
  ])
  const currentPage = allItems.find((item) => item.href === pathname)
  const currentTitle = currentPage?.title || 'Documentation'

  return (
    <div className="sticky top-16 z-30 lg:hidden">
      <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] bg-[color:var(--background)]/95 backdrop-blur-sm px-4 py-2.5">
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
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('docs-search-open'))}
          className="rounded-[4px] p-1.5 text-[color:var(--text-secondary)] transition hover:text-[color:var(--foreground)]"
          aria-label="Search documentation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
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
                    {category.items.map((item) => (
                      <MobileNavItem
                        key={item.slug}
                        item={item}
                        pathname={pathname}
                        onNavigate={() => setIsOpen(false)}
                      />
                    ))}
                  </ul>
                  {category.subsections?.map((sub) => (
                    <MobileSubsectionNav
                      key={sub.title}
                      sub={sub}
                      pathname={pathname}
                      onNavigate={() => setIsOpen(false)}
                    />
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
