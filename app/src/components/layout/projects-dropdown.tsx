'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useProjects } from '@/hooks/use-projects'
import { DropdownButton } from '@/components/ui'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'

function isProjectsActive(pathname: string) {
  return pathname === '/projects' || pathname.startsWith('/projects/')
}

export function ProjectsDropdown() {
  const [open, setOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()
  const { projects, isLoading, refresh: refreshProjects } = useProjects()

  const active = isProjectsActive(pathname)

  const handleCreateProject = () => {
    setOpen(false)
    setShowCreateDialog(true)
  }

  const handleProjectCreated = () => {
    void refreshProjects()
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('pointerdown', handlePointerDown)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <DropdownButton open={open} active={active} onClick={() => setOpen((prev) => !prev)}>
        Projects
      </DropdownButton>

      {open ? (
        <div className="absolute left-0 z-50 mt-1 min-w-[160px] rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-1">
          <Link
            href="/projects"
            className="block px-2 py-1 font-mono text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
          >
            All projects
          </Link>

          {projects.length > 0 ? (
            <>
              <div className="my-1 border-t border-[color:var(--border-subtle)]" />
              <div className="max-h-[240px] overflow-y-auto">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block px-2 py-1 font-mono text-xs text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-hover)]"
                  >
                    {project.name}
                  </Link>
                ))}
              </div>
            </>
          ) : isLoading ? (
            <>
              <div className="my-1 border-t border-[color:var(--border-subtle)]" />
              <div className="px-2 py-1 font-mono text-xs text-[color:var(--text-secondary)]">
                Loading...
              </div>
            </>
          ) : null}

          <div className="my-1 border-t border-[color:var(--border-subtle)]" />
          <button
            type="button"
            onClick={handleCreateProject}
            className="flex w-full items-center gap-2 px-2 py-1 font-mono text-xs text-[color:var(--accent-primary)] transition hover:bg-[color:var(--surface-hover)]"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create project
          </button>
        </div>
      ) : null}

      <CreateProjectDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  )
}
