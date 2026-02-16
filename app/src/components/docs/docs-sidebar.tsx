'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/class'
import { Collapsible } from '@/components/ui/collapsible'
import { DOCS_NAV } from '@/app/(marketing)/docs/_config/docs-nav'

interface DocsSidebarProps {
  className?: string
}

export function DocsSidebar({ className }: DocsSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className={cn('w-64 shrink-0', className)}>
      <div className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto pb-8">
        <nav className="space-y-4" aria-label="Documentation navigation">
          {DOCS_NAV.map((category) => {
            const isCategoryActive = pathname.startsWith(`/docs/${category.slug}`)

            return (
              <Collapsible
                key={category.slug}
                defaultOpen={isCategoryActive}
                trigger={category.title}
              >
                <ul className="space-y-0.5">
                  {category.items.map((item) => {
                    const isActive = pathname === item.href

                    return (
                      <li key={item.slug}>
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
                  })}
                </ul>
              </Collapsible>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
