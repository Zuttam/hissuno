'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { ProjectWithAnalyses } from '@/lib/supabase/projects'
import { useProjects } from '@/hooks/use-projects'

interface DeveloperDashboardProps {
  initialProjects: ProjectWithAnalyses[]
}

export function DeveloperDashboard({ initialProjects }: DeveloperDashboardProps) {
  const { projects, isLoading, error, refresh } = useProjects(initialProjects)

  const projectCards = useMemo(() => {
    if (projects.length === 0) return null
    return projects.map((project) => <ProjectCard key={project.id} project={project} />)
  }, [projects])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-linear-to-br from-slate-50 via-white to-slate-100 px-8 py-10 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col justify-between gap-6 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-lg shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none md:flex-row md:items-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Customize Developer Studio
            </h1>
            <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Manage onboarding for every platform integration. Create a project, run code analysis,
              and collaborate with the agent to perfect the generated components and APIs.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <Link
              href="/projects/new"
              className="whitespace-nowrap rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Start new project
            </Link>
            <button
              type="button"
              onClick={() => {
                void refresh()
              }}
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            >
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
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
  project: ProjectWithAnalyses
}

function ProjectCard({ project }: ProjectCardProps) {
  const latestAnalysis = project.project_analyses?.[0]
  const status = latestAnalysis?.status ?? 'pending'
  const statusStyles = getStatusStyles(status)
  const analysisCount = project.project_analyses?.length ?? 0

  return (
    <article className="group relative flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/80">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 transition group-hover:text-slate-700 dark:text-slate-50 dark:group-hover:text-white">
            {project.name}
          </h2>
          <span className={`${statusStyles} rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide`}>
            {statusLabel(status)}
          </span>
        </div>
        {project.description ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{project.description}</p>
        ) : (
          <p className="text-sm italic text-slate-400 dark:text-slate-500">No description yet.</p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
        <div className="flex flex-col gap-1 text-left">
          <span>Analyses: {analysisCount}</span>
          <span>
            {latestAnalysis?.completed_at
              ? `Last run ${formatTimestamp(latestAnalysis.completed_at)}`
              : latestAnalysis?.started_at
                ? `Started ${formatTimestamp(latestAnalysis.started_at)}`
                : 'Waiting for first analysis'}
          </span>
        </div>
        <Link
          href={`/projects/${project.id}`}
          className="rounded-full bg-blue-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-blue-500"
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
          className="h-48 animate-pulse rounded-3xl border border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/60"
        />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white/80 px-10 py-14 text-center shadow-inner dark:border-slate-700 dark:bg-slate-900/60">
      <div className="mx-auto max-w-xl space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Launch your first project</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload a codebase or point to a local path. Customize will analyze the design system, available APIs,
          and keep your history so you can iterate with the agent.
        </p>
        <Link
          href="/projects/new"
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-500"
        >
          Start onboarding
        </Link>
      </div>
    </div>
  )
}

function getStatusStyles(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
    case 'running':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
    case 'failed':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'running':
      return 'Running'
    case 'failed':
      return 'Failed'
    case 'pending':
      return 'Pending'
    default:
      return status
  }
}

function formatTimestamp(timestamp: string) {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString()
  } catch {
    return timestamp
  }
}

