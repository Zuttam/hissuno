'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils/class'
import type { TocItem } from '@/app/(marketing)/docs/_lib/toc'

interface DocsTocProps {
  items: TocItem[]
}

export function DocsToc({ items }: DocsTocProps) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    if (items.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -80% 0px', threshold: 0 }
    )

    for (const item of items) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null

  return (
    <nav className="hidden xl:block" aria-label="Table of contents">
      <div className="sticky top-24">
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          On this page
        </p>
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={cn(
                  'block text-sm transition',
                  item.level === 3 && 'pl-3',
                  activeId === item.id
                    ? 'text-[color:var(--accent-teal)] font-medium'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)]'
                )}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
