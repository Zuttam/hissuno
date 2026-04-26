'use client'

import Link from 'next/link'
import type { SessionUser } from '@/lib/auth/server'
import { ThemeLogo } from '@/components/ui'
import { useProject } from '@/components/providers/project-provider'
import { useSidebarState } from './use-sidebar-state'
import { SidebarNavItem, type NavItemConfig } from './sidebar-nav-item'
import { SidebarProjectSelector } from './sidebar-project-selector'
import { SidebarAccountSection } from './sidebar-account-section'
import { SidebarResourceTree } from './sidebar-resource-tree'

// Icons for navigation items
function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  )
}

function GraphIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="5" cy="6" r="2.5" />
      <circle cx="19" cy="6" r="2.5" />
      <circle cx="12" cy="19" r="2.5" />
      <path strokeLinecap="round" d="M7.5 6h9M6.5 8.2l4.5 8.6M17.5 8.2l-4.5 8.6" />
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

function AutomationsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  )
}

function ConfigurationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
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

// Top section: project-level configuration pages
const CONFIG_NAV_ITEMS: NavItemConfig[] = [
  { href: '/projects/[id]/dashboard', label: 'Dashboard', icon: <DashboardIcon className="h-3.5 w-3.5" /> },
  { href: '/projects/[id]/graph', label: 'Graph', icon: <GraphIcon className="h-3.5 w-3.5" /> },
  { href: '/projects/[id]/integrations', label: 'Integrations', icon: <IntegrationsIcon className="h-3.5 w-3.5" /> },
  { href: '/projects/[id]/automations', label: 'Automations', icon: <AutomationsIcon className="h-3.5 w-3.5" /> },
  { href: '/projects/[id]/configuration', label: 'Configuration', icon: <ConfigurationIcon className="h-3.5 w-3.5" /> },
]

function ResourcesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
    </svg>
  )
}

interface AppSidebarProps {
  user: SessionUser | null
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { isCollapsed, isMobileOpen, sidebarWidth, isResizing, toggleCollapsed, setMobileOpen, closeMobile, onResizeStart } = useSidebarState()
  const { projectId: currentProjectId } = useProject()

  const renderSidebarContent = (forMobile = false) => {
    const collapsed = forMobile ? false : isCollapsed

    return (
      <>
        {/* Logo and collapse button */}
        <div className={`flex h-16 items-center border-b border-[color:var(--border-subtle)] ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          <Link href="/projects" className="flex items-end gap-1.5" onClick={closeMobile}>
            {collapsed ? (
              <ThemeLogo width={24} height={24} priority />
            ) : (
              <>
                <ThemeLogo width={56} height={16} priority />
                {/* <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500 leading-none">beta</span> */}
              </>
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

        {/* Config navigation */}
        <nav className={`py-2 ${collapsed ? '' : 'border-b border-[color:var(--border-subtle)]'}`}>
          <div className={`flex flex-col gap-0.5 ${collapsed ? 'px-1.5' : 'px-2'}`}>
            {CONFIG_NAV_ITEMS.map((item) => (
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

        {/* Resources tree */}
        {collapsed ? (
          <div className="flex flex-1 flex-col items-center pt-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[color:var(--text-tertiary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] cursor-pointer"
              title="Show resources"
            >
              <ResourcesIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <SidebarResourceTree isCollapsed={collapsed} onNavigate={closeMobile} />
        )}

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
        className={`hidden md:flex flex-col flex-shrink-0 border-r border-[color:var(--border-subtle)] backdrop-blur-xl bg-[color:var(--background)]/80 relative z-50 ${isResizing ? '' : 'transition-all duration-300'}`}
        style={{ width: sidebarWidth }}
      >
        {renderSidebarContent(false)}
        {/* Resize handle */}
        {!isCollapsed && (
          <div
            onMouseDown={onResizeStart}
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[color:var(--border-active)] transition-colors z-10 group"
          >
            <div className="absolute top-0 -left-1 w-3 h-full" />
          </div>
        )}
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
