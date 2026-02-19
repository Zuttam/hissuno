'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useProject } from '@/components/providers/project-provider'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'

interface SidebarProjectSelectorProps {
  isCollapsed: boolean
  onNavigate?: () => void
}

export function SidebarProjectSelector({ isCollapsed, onNavigate }: SidebarProjectSelectorProps) {
  const [open, setOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { project: currentProject, projectId: currentProjectId, setProjectId, isLoading: isLoadingProject, projects, isLoadingProjects, refreshProjects } = useProject()

  const isLoading = isLoadingProjects || isLoadingProject

  const handleCreateProject = () => {
    setOpen(false)
    setShowCreateDialog(true)
  }

  const handleProjectCreated = (project: { id: string; name: string }) => {
    void refreshProjects()
    setProjectId(project.id)
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

  const handleProjectSelect = (newProjectId: string) => {
    setProjectId(newProjectId)
    setOpen(false)
    onNavigate?.()
    // Navigate to the same sub-route but for the new project
    const subRoute = pathname.match(/\/projects\/[^/]+\/(.+)/)?.[1] ?? 'dashboard'
    router.push(`/projects/${newProjectId}/${subRoute}`)
  }

  if (isCollapsed) {
    return (
      <div className="relative flex justify-center" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-8 w-8 items-center justify-center rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
          title={currentProject?.name ?? 'Select project'}
        >
          <span className="font-mono text-xs font-bold uppercase">
            {currentProject?.name?.slice(0, 2) ?? 'PR'}
          </span>
        </button>

        {open && (
          <div className="absolute left-full top-0 z-50 ml-2 min-w-[200px] rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-1 shadow-lg">
            <div className="px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">
              Projects
            </div>
            {isLoading ? (
              <div className="px-2 py-2 font-mono text-xs text-[color:var(--text-secondary)]">
                Loading...
              </div>
            ) : projects.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleProjectSelect(project.id)}
                    className={`flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left font-mono text-xs transition ${
                      project.id === currentProjectId
                        ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                        : 'text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]'
                    }`}
                  >
                    {project.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-2 py-2 font-mono text-xs text-[color:var(--text-secondary)]">
                No projects yet
              </div>
            )}
            <div className="mt-1 border-t border-[color:var(--border-subtle)] pt-1">
              <button
                type="button"
                onClick={() => {
                  handleCreateProject()
                  onNavigate?.()
                }}
                className="flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 font-mono text-xs text-[color:var(--accent-primary)] transition hover:bg-[color:var(--surface-hover)]"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create project
              </button>
            </div>
          </div>
        )}

        <CreateProjectDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onProjectCreated={handleProjectCreated}
        />
      </div>
    )
  }

  return (
    <div className="relative px-2" ref={containerRef}>
      <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">
        Project
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-2 py-1.5 text-left font-mono text-xs text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
      >
        <span className="truncate font-semibold">
          {currentProject?.name ?? (isLoading ? 'Loading...' : 'Select project')}
        </span>
        <svg
          className={`h-3.5 w-3.5 flex-shrink-0 text-[color:var(--text-tertiary)] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-2 right-2 z-50 mt-1 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-1 shadow-lg">
          {isLoading ? (
            <div className="px-2 py-2 font-mono text-xs text-[color:var(--text-secondary)]">
              Loading...
            </div>
          ) : projects.length > 0 ? (
            <div className="max-h-[300px] overflow-y-auto">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleProjectSelect(project.id)}
                  className={`flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left font-mono text-xs transition ${
                    project.id === currentProjectId
                      ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                      : 'text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]'
                  }`}
                >
                  {project.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-2 py-2 font-mono text-xs text-[color:var(--text-secondary)]">
              No projects yet
            </div>
          )}
          <div className="mt-1 border-t border-[color:var(--border-subtle)] pt-1">
            <button
              type="button"
              onClick={() => {
                handleCreateProject()
                onNavigate?.()
              }}
              className="flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 font-mono text-xs text-[color:var(--accent-primary)] transition hover:bg-[color:var(--surface-hover)]"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create project
            </button>
          </div>
        </div>
      )}

      <CreateProjectDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  )
}
