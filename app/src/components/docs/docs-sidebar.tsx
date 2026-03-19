'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/class'
import { Collapsible } from '@/components/ui/collapsible'
import { DOCS_NAV } from '@/app/(marketing)/docs/_config/docs-nav'
import type { DocNavItem, DocNavSubsection } from '@/app/(marketing)/docs/_config/docs-nav'

interface DocsSidebarProps {
  className?: string
}

function NavItem({ item, pathname }: { item: DocNavItem; pathname: string }) {
  const isActive = pathname === item.href

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          'block rounded-[4px] py-1.5 pl-3 text-sm transition',
          isActive
            ? 'border-l-2 border-[color:var(--accent-teal)] text-[color:var(--accent-teal)] font-medium'
            : 'border-l-2 border-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]'
        )}
      >
        {item.title}
      </Link>
    </li>
  )
}

function SubsectionNav({ sub, pathname }: { sub: DocNavSubsection; pathname: string }) {
  const isSubActive = sub.items.some((item) => pathname === item.href)
  const [isOpen, setIsOpen] = useState(isSubActive)

  return (
    <div className="mt-1">
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
            <NavItem key={item.slug} item={item} pathname={pathname} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function DocsSidebar({ className }: DocsSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className={cn('w-64 shrink-0', className)}>
      <div className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto pb-8">
        <nav className="space-y-4" aria-label="Documentation navigation">
          {DOCS_NAV.map((category) => {
            const isCategoryActive =
              pathname.startsWith(`/docs/${category.slug}`) ||
              category.subsections?.some((sub) => sub.items.some((item) => pathname === item.href)) ||
              false

            return (
              <Collapsible
                key={category.slug}
                defaultOpen={isCategoryActive}
                trigger={category.title}
              >
                <ul className="space-y-0.5">
                  {category.items.map((item) => (
                    <NavItem key={item.slug} item={item} pathname={pathname} />
                  ))}
                </ul>
                {category.subsections?.map((sub) => (
                  <SubsectionNav key={sub.title} sub={sub} pathname={pathname} />
                ))}
              </Collapsible>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
