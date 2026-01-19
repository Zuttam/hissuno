'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import type { ProjectRecord } from '@/lib/supabase/projects'
import { useProjects } from '@/hooks/use-projects'
import { Button, PageHeader } from '@/components/ui'
import { FloatingCard } from '../ui/floating-card'
import { ProjectsAnalyticsStrip } from '@/components/analytics'

interface ProjectsProps {
  initialProjects: ProjectRecord[]
}

export function Projects({ initialProjects }: ProjectsProps) {
  const { projects, isLoading, error, refresh } = useProjects(initialProjects)

  const projectCards = useMemo(() => {
    if (projects.length === 0) return null
    return projects.map((project) => <ProjectCard key={project.id} project={project} />)
  }, [projects])

  const router = useRouter()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <PageHeader
        title="Projects"
        onRefresh={() => void refresh()}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/projects/new')}
          >
            Create
          </Button>
        }
      />
      <ProjectsAnalyticsStrip projects={projects} />

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
        </section>
      )}
    </div>
  )
}

interface ProjectCardProps {
  project: ProjectRecord
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

