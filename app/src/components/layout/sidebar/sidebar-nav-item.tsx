'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export interface NavItemConfig {
  href: string
  label: string
  icon: ReactNode
  badge?: string
  disabled?: boolean
}

interface SidebarNavItemProps {
  item: NavItemConfig
  isCollapsed: boolean
  projectId?: string
  onNavigate?: () => void
}

function isActivePath(pathname: string, href: string, projectId?: string) {
  // For project-scoped routes, check if path matches within project context
  if (projectId && href.startsWith('/projects/[id]')) {
    const actualPath = href.replace('[id]', projectId)
    return pathname === actualPath || pathname.startsWith(`${actualPath}/`)
  }

  if (href === '/') {
    return pathname === '/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SidebarNavItem({ item, isCollapsed, projectId, onNavigate }: SidebarNavItemProps) {
  const pathname = usePathname()

  // Replace [id] placeholder with actual project ID
  const hasPlaceholder = item.href.includes('[id]')
  const href = projectId ? item.href.replace('[id]', projectId) : item.href
  const active = isActivePath(pathname, item.href, projectId)

  // Disable if explicitly disabled OR if href has unresolved placeholder
  const disabled = item.disabled ?? (hasPlaceholder && !projectId)

  if (disabled) {
    return (
      <span
        className={`flex items-center gap-2 px-2 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-tertiary)] opacity-40 ${
          isCollapsed ? 'justify-center' : ''
        }`}
        title={isCollapsed ? item.label : undefined}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {!isCollapsed && <span>{item.label}</span>}
      </span>
    )
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2 px-2 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide transition ${
        isCollapsed ? 'justify-center' : ''
      } ${
        active
          ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
          : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]'
      }`}
      title={isCollapsed ? item.label : undefined}
    >
      <span className="flex-shrink-0">{item.icon}</span>
      {!isCollapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge && (
            <span className="rounded-[4px] border border-[color:var(--accent-warning)] bg-transparent px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--accent-warning)]">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}
