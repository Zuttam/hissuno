'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export interface NavItem {
  href: string
  label: string
  badge?: string
  disabled?: boolean
}

function isActivePath(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppNavigation({ items, leadingElement }: { items: NavItem[]; leadingElement?: ReactNode }) {
  const pathname = usePathname()

  return (
    <nav className="hidden md:flex items-center gap-1 text-sm font-mono font-semibold">
      {leadingElement}
      {items.map((item) => {
        const active = isActivePath(pathname, item.href)
        const disabled = item.disabled ?? false
        if (disabled) {
          return (
            <span key={item.href} className="flex items-center gap-2 px-4 py-2 uppercase tracking-wide text-[--text-tertiary] opacity-40">
              {item.label}
            </span>
          )
        }
        return (
          <Link
            key={item.href}
            href={item.href}
         
            className={`flex items-center gap-2 px-3 py-2 uppercase tracking-wide transition ${
              active
                ? 'bg-[--foreground] text-[--background]'
                : 'bg-transparent text-[--text-secondary] hover:bg-[--surface-hover]'
            }`}
          >
            <span>{item.label}</span>
            {item.badge ? (
              <span className="rounded-[4px] border border-[--accent-warning] bg-transparent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[--accent-warning]">
                {item.badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
