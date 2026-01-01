'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { useProjects } from '@/hooks/use-projects'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { RefreshIcon } from '@/components/ui/refresh-icon'
import { Card } from '@/components/ui/card'
import { FloatingCard } from '../ui/floating-card'

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="h-8 w-8"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

interface ProjectsProps {
  initialProjects: ProjectWithCodebase[]
}

export function Projects({ initialProjects }: ProjectsProps) {
  const { projects, isLoading, error, refresh } = useProjects(initialProjects)

  const projectCards = useMemo(() => {
    if (projects.length === 0) return null
    return projects.map((project) => <ProjectCard key={project.id} project={project} />)
  }, [projects])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex items-center gap-3">
        <h1 className="font-mono text-3xl font-bold uppercase tracking-tight text-[color:var(--foreground)]">
          Projects
        </h1>
        <IconButton
          aria-label="Refresh projects"
          variant="ghost"
          size="md"
          onClick={() => void refresh()}
        >
          <RefreshIcon />
        </IconButton>
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
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projectCards}
          <AddProjectCard />
        </section>
      )}
    </div>
  )
}

interface ProjectCardProps {
  project: ProjectWithCodebase
}

function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()

  return (
    <FloatingCard 
        variant="elevated" floating="gentle">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-lg font-bold uppercase text-[color:var(--foreground)]">
            {project.name}
          </h2>
        </div>
        {project.description ? (
          <p className="text-sm text-[color:var(--text-secondary)]">{project.description}</p>
        ) : (
          <p className="text-sm italic text-[color:var(--text-tertiary)]">No description yet.</p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
        <Button
          variant="primary"
          size="md"
          onClick={() => router.push(`/projects/${project.id}`)}
        >
          Open project
        </Button>
      </div>
    </FloatingCard>
  )
}

function AddProjectCard() {
  return (
    <Card className="group flex h-full min-h-[180px] flex-col items-center justify-center rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-transparent p-6 transition-all duration-200 hover:border-[color:var(--border)] hover:-translate-y-0.5">
      <Link
        href="/projects/new"
        className="flex flex-col items-center gap-3 text-center"
      >
        <span className="text-[color:var(--text-tertiary)] transition-colors group-hover:text-[color:var(--text-secondary)]">
          <PlusIcon />
        </span>
        <span className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] transition-colors group-hover:text-[color:var(--foreground)]">
          Create Project
        </span>
      </Link>
    </Card>
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

