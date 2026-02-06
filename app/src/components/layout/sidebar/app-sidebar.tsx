'use client'

import Link from 'next/link'
import type { SessionUser } from '@/lib/auth/server'
import { ThemeLogo } from '@/components/ui'
import { useProject } from '@/components/providers/project-provider'
import { useSidebarState } from './use-sidebar-state'
import { SidebarNavItem, type NavItemConfig } from './sidebar-nav-item'
import { SidebarProjectSelector } from './sidebar-project-selector'
import { SidebarAccountSection } from './sidebar-account-section'

// Icons for navigation items
function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  )
}

function SessionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  )
}

function IssuesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
    </svg>
  )
}

function AgentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  )
}

function IntegrationsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  )
}

function CollapseIcon({ className, collapsed }: { className?: string; collapsed: boolean }) {
  return (
    <svg
      className={`${className} transition-transform ${collapsed ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

// Navigation items configuration - project-scoped routes
const PROJECT_NAV_ITEMS: NavItemConfig[] = [
  { href: '/projects/[id]/dashboard', label: 'Dashboard', icon: <DashboardIcon className="h-4 w-4" /> },
  { href: '/projects/[id]/sessions', label: 'Sessions', icon: <SessionsIcon className="h-4 w-4" /> },
  { href: '/projects/[id]/issues', label: 'Issues', icon: <IssuesIcon className="h-4 w-4" /> },
  { href: '/projects/[id]/agents', label: 'Agents', icon: <AgentsIcon className="h-4 w-4" /> },
  { href: '/projects/[id]/integrations', label: 'Integrations', icon: <IntegrationsIcon className="h-4 w-4" /> },
]

interface AppSidebarProps {
  user: SessionUser | null
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { isCollapsed, isMobileOpen, toggleCollapsed, setMobileOpen, closeMobile } = useSidebarState()
  const { projectId: currentProjectId } = useProject()

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-60'

  const renderSidebarContent = (forMobile = false) => {
    const collapsed = forMobile ? false : isCollapsed

    return (
      <>
        {/* Logo and collapse button */}
        <div className={`flex h-16 items-center border-b border-[color:var(--border-subtle)] ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          <Link href="/projects" className="flex items-center gap-2" onClick={closeMobile}>
            {collapsed ? (
              <ThemeLogo width={24} height={24} priority />
            ) : (
              <ThemeLogo width={56} height={16} priority />
            )}
          </Link>
          {!collapsed && !forMobile && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-[4px] text-[color:var(--text-tertiary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] cursor-pointer"
              title="Collapse sidebar"
            >
              <CollapseIcon className="h-3 w-3" collapsed={false} />
            </button>
          )}
          {collapsed && !forMobile && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden md:flex fixed top-5 h-6 w-6 items-center justify-center rounded-full border border-[color:var(--border-subtle)] backdrop-blur-xl bg-[color:var(--background)]/95 text-[color:var(--text-tertiary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] cursor-pointer shadow-lg z-10"
              style={{ left: 'calc(4rem - 0.75rem)' }}
              title="Expand sidebar"
            >
              <CollapseIcon className="h-4 w-4" collapsed />
            </button>
          )}
        </div>

        {/* Project selector */}
        <div className={`border-b border-[color:var(--border-subtle)] ${collapsed ? 'py-2' : 'py-2.5'}`}>
          <SidebarProjectSelector isCollapsed={collapsed} onNavigate={closeMobile} />
        </div>

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          <div className={`space-y-0.5 ${collapsed ? 'px-1.5' : 'px-2'}`}>
            {PROJECT_NAV_ITEMS.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                isCollapsed={collapsed}
                projectId={currentProjectId ?? undefined}
                onNavigate={closeMobile}
              />
            ))}
          </div>
        </nav>

        {/* Account section */}
        <div className={`border-t border-[color:var(--border-subtle)] ${collapsed ? 'py-2' : 'py-2.5'}`}>
          <SidebarAccountSection user={user} isCollapsed={collapsed} onNavigate={closeMobile} />
        </div>
      </>
    )
  }

  return (
    <>
      {/* Mobile hamburger button - shown in header area */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 flex md:hidden h-10 w-10 items-center justify-center rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-hover)]"
        style={{ zIndex: 60 }}
        aria-label="Open menu"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col ${sidebarWidth} flex-shrink-0 border-r border-[color:var(--border-subtle)] backdrop-blur-xl bg-[color:var(--background)]/80 transition-all duration-300 relative z-50`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile sidebar overlay */}
      {isMobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm md:hidden"
            style={{ zIndex: 55 }}
            onClick={closeMobile}
            aria-hidden="true"
          />

          {/* Slide-out sidebar */}
          <aside className="fixed left-0 top-0 flex h-full w-full flex-col backdrop-blur-xl bg-[color:var(--background)]/80 shadow-xl md:hidden" style={{ zIndex: 60 }}>
            {/* Close button */}
            <button
              type="button"
              onClick={closeMobile}
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-[4px] text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
              style={{ zIndex: 61 }}
              aria-label="Close menu"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            {renderSidebarContent(true)}
          </aside>
        </>
      )}
    </>
  )
}
