'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { useProjects } from '@/hooks/use-projects'

interface DeveloperDashboardProps {
  initialProjects: ProjectWithCodebase[]
}

export function DeveloperProjects({ initialProjects }: DeveloperDashboardProps) {
  const { projects, isLoading, error, refresh } = useProjects(initialProjects)

  const projectCards = useMemo(() => {
    if (projects.length === 0) return null
    return projects.map((project) => <ProjectCard key={project.id} project={project} />)
  }, [projects])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[color:var(--background)] px-8 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col justify-between gap-6 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-8 md:flex-row md:items-center">
          <div className="space-y-2">
            <h1 className="font-mono text-3xl font-bold uppercase tracking-tight text-[color:var(--foreground)]">
              Hissuno Dev
            </h1>
            <p className="max-w-2xl text-sm text-[color:var(--text-secondary)]">
              Manage your projects and source code. Create a project, upload source code,
              and keep everything organized.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <Link
              href="/projects/new"
              className="whitespace-nowrap rounded-[4px] border-2 border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)] px-5 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-[color:var(--accent-primary-hover)] hover:border-[color:var(--accent-primary-hover)]"
            >
              Start new project
            </Link>
            <button
              type="button"
              onClick={() => {
                void refresh()
              }}
              className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-5 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
            >
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
            {error}
          </div>
        )}

        {isLoading && projects.length === 0 ? (
          <ProjectsSkeleton />
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{projectCards}</section>
        )}
      </div>
    </div>
  )
}

interface ProjectCardProps {
  project: ProjectWithCodebase
}

function ProjectCard({ project }: ProjectCardProps) {
  const hasSource = Boolean(project.source_code)
  const sourceType = project.source_code?.kind ?? 'none'

  return (
    <article className="group relative flex h-full flex-col justify-between rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-6 transition-all duration-200 hover:border-[color:var(--border)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-lg font-bold uppercase text-[color:var(--foreground)]">
            {project.name}
          </h2>
          <span className={`${getSourceStyles(hasSource)} rounded-[4px] border-2 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider`}>
            {hasSource ? sourceType : 'No source'}
          </span>
        </div>
        {project.description ? (
          <p className="text-sm text-[color:var(--text-secondary)]">{project.description}</p>
        ) : (
          <p className="text-sm italic text-[color:var(--text-tertiary)]">No description yet.</p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
        <div className="flex flex-col gap-1 text-left">
          <span>Source: {project.source_code ? 'Connected' : 'None'}</span>
        </div>
        <Link
          href={`/projects/${project.id}`}
          className="rounded-[4px] border-2 border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-[color:var(--accent-primary-hover)] hover:border-[color:var(--accent-primary-hover)]"
        >
          Open project
        </Link>
      </div>
    </article>
  )
}

function ProjectsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-48 animate-pulse rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)]"
        />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-10 py-14 text-center">
      <div className="mx-auto max-w-xl space-y-4">
        <h2 className="font-mono text-2xl font-bold uppercase text-[color:var(--foreground)]">Launch your first project</h2>
        <p className="text-sm text-[color:var(--text-secondary)]">
          Upload a codebase folder today—GitHub connections are coming soon. Hissuno will help you
          manage your source code and keep everything organized.
        </p>
        <Link
          href="/projects/new"
          className="inline-flex items-center justify-center rounded-[4px] border-2 border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)] px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-[color:var(--accent-primary-hover)] hover:border-[color:var(--accent-primary-hover)]"
        >
          Start new project
        </Link>
      </div>
    </div>
  )
}

function getSourceStyles(hasSource: boolean) {
  if (hasSource) {
    return 'border-[color:var(--accent-success)] bg-transparent text-[color:var(--accent-success)]'
  }
  return 'border-[color:var(--border)] bg-transparent text-[color:var(--text-secondary)]'
}
