'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useProject } from '@/components/providers/project-provider'
import { MenuIcon } from '@/components/ui/menu-icon'
import type { NavItem } from './app-navigation'

interface MobileNavigationProps {
  items: NavItem[]
}

function isActivePath(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isProjectsActive(pathname: string) {
  return pathname === '/projects' || pathname.startsWith('/projects/')
}

export function MobileNavigation({ items }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [projectsExpanded, setProjectsExpanded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { projects, isLoadingProjects: isLoading } = useProject()

  // Close on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Close on escape key and handle click outside
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('mousedown', handleClickOutside)
      // Lock body scroll
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const projectsActive = isProjectsActive(pathname)

  return (
    <div className="md:hidden">
      {/* Hamburger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center p-2 text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-hover)]"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        <MenuIcon isOpen={isOpen} className="h-6 w-6" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 z-50 h-full w-72 transform bg-[color:var(--background)] shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] p-4">
          <span className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--foreground)]">
            Menu
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center p-1 text-[color:var(--text-secondary)] transition hover:text-[color:var(--foreground)]"
            aria-label="Close menu"
          >
            <MenuIcon isOpen className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation content */}
        <nav className="flex flex-col p-4">
          {/* Projects section */}
          <div className="border-b border-[color:var(--border-subtle)] pb-4 mb-4">
            <button
              type="button"
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className={`flex w-full items-center justify-between px-3 py-2 font-mono text-sm font-semibold uppercase tracking-wide transition ${
                projectsActive
                  ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
              }`}
            >
              <span>Projects</span>
              <svg
                className={`h-4 w-4 transition-transform ${projectsExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {projectsExpanded && (
              <div className="mt-2 space-y-1 pl-3">
                <Link
                  href="/projects"
                  className="block px-3 py-2 font-mono text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
                >
                  All projects
                </Link>
                {isLoading ? (
                  <div className="px-3 py-2 font-mono text-xs text-[color:var(--text-tertiary)]">
                    Loading...
                  </div>
                ) : projects.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto">
                    {projects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}/sessions`}
                        className="block px-3 py-2 font-mono text-xs text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-hover)]"
                      >
                        {project.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Main navigation items */}
          <div className="space-y-1">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href)
              const disabled = item.disabled ?? false

              if (disabled) {
                return (
                  <span
                    key={item.href}
                    className="flex items-center gap-2 px-3 py-2 font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-tertiary)] opacity-40"
                  >
                    {item.label}
                  </span>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 font-mono text-sm font-semibold uppercase tracking-wide transition ${
                    active
                      ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                      : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="rounded-[4px] border border-[color:var(--accent-warning)] bg-transparent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--accent-warning)]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
