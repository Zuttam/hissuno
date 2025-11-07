'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ProjectWithAnalyses } from '@/lib/supabase/projects'
import { useProjectDetail } from '@/hooks/use-projects'

interface ProjectAnalysisProgressProps {
  projectId: string
  initialProject: ProjectWithAnalyses
}

export function ProjectAnalysisProgress({ projectId, initialProject }: ProjectAnalysisProgressProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cameFromCreate = searchParams?.get('firstRun') === '1'
  const { project, latestAnalysis, isLoading, error } = useProjectDetail({
    projectId,
    initialProject,
    autoRefresh: true,
  })

  const status = latestAnalysis?.status ?? (isLoading ? 'running' : 'pending')

  useEffect(() => {
    if (status === 'completed') {
      const timeout = setTimeout(() => {
        router.push(`/projects/${projectId}/analysis/edit`)
      }, cameFromCreate ? 1200 : 600)
      return () => clearTimeout(timeout)
    }
  }, [status, router, projectId, cameFromCreate])

  const steps = useMemo(() => buildSteps(status), [status])

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 px-6 py-10 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <nav className="text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-slate-900 dark:hover:text-white">
            ← Back to projects
          </Link>
        </nav>

        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Initial analysis in progress
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {project?.name ?? initialProject.name} is being processed. We’ll transfer you to the editor as soon as
            results are ready.
          </p>
        </header>

        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusStyles(status)}`}>
              {statusLabel(status)}
            </span>
            {latestAnalysis?.started_at && (
              <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Started {formatTimestamp(latestAnalysis.started_at)}
              </span>
            )}
          </div>

          <ol className="space-y-3">
            {steps.map((step) => (
              <li
                key={step.label}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                  step.complete
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/30 dark:text-emerald-200'
                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300'
                }`}
              >
                <span>{step.label}</span>
                {step.complete ? <span className="text-xs uppercase tracking-wide">Done</span> : step.active ? <Spinner /> : null}
              </li>
            ))}
          </ol>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {error}
            </div>
          )}

          {status === 'failed' && latestAnalysis?.error_message && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {latestAnalysis.error_message}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/projects/${projectId}/analysis/edit`}
              className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500"
            >
              {status === 'completed' ? 'View results' : 'Open editor'}
            </Link>
            <Link
              href={`/projects/${projectId}`}
              className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            >
              Project overview
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function buildSteps(status: string) {
  return [
    {
      label: 'Archive received',
      complete: true,
      active: status === 'pending',
    },
    {
      label: 'Analyzer running',
      complete: status === 'completed' || status === 'failed',
      active: status === 'running',
    },
    {
      label: 'Review results',
      complete: status === 'completed',
      active: status === 'completed',
    },
  ]
}

function Spinner() {
  return (
    <span className="flex h-5 w-5 items-center justify-center">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </span>
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

