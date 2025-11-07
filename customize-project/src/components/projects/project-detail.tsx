'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { AnalyzerResponse } from '@/types/analyzer'
import type { ProjectWithAnalyses } from '@/lib/supabase/projects'
import { updateProject } from '@/lib/projects/client'
import { useProjectDetail } from '@/hooks/use-projects'
import { AnalysisTabs } from '@/components/analysis/analysis-tabs'

interface ProjectDetailProps {
  projectId: string
  initialProject: ProjectWithAnalyses
}

export function ProjectDetail({ projectId, initialProject }: ProjectDetailProps) {
  const { project, latestAnalysis, isLoading, error, refresh } = useProjectDetail({
    projectId,
    initialProject,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'design' | 'api'>('design')

  const analysisResponse = useMemo(() => {
    if (!latestAnalysis?.result) return null
    return latestAnalysis.result as unknown as AnalyzerResponse
  }, [latestAnalysis])

  const summary = useMemo(() => {
    if (!latestAnalysis?.summary) return null
    return latestAnalysis.summary as unknown as AnalysisSummary
  }, [latestAnalysis])

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 px-6 py-10 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <nav className="text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-slate-900 dark:hover:text-white">
            ← Back to projects
          </Link>
        </nav>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        )}

        <header className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-lg shadow-slate-200/50 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {project?.name ?? initialProject.name}
            </h1>
            <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">
              Review the latest analysis, keep project metadata up to date, and jump into iterative editing.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            >
              Edit metadata
            </button>
            <Link
              href={`/projects/${projectId}/analysis/edit`}
              className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500"
            >
              Continue editing
            </Link>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <MetadataCard project={project ?? initialProject} />
          <StatusCard latestAnalysis={latestAnalysis ?? null} summary={summary} isLoading={isLoading} />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Latest analysis</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                View-only snapshot of the most recent run. Jump to the editor for prompt iterations.
              </p>
            </div>
            {latestAnalysis && (
              <span className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusStyles(latestAnalysis.status)}`}>
                {statusLabel(latestAnalysis.status)}
              </span>
            )}
          </div>

          <div className="mt-6">
            {analysisResponse ? (
              <AnalysisTabs analysis={analysisResponse} selectedTab={selectedTab} onTabChange={setSelectedTab} />
            ) : isLoading ? (
              <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50" />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                Run an analysis to see results here.
              </div>
            )}
          </div>
        </section>

        <AnalysisHistorySection analyses={project?.project_analyses ?? initialProject.project_analyses} />
      </div>

      {project && isEditing && (
        <EditProjectDialog
          project={project}
          onClose={() => setIsEditing(false)}
          onSaved={async () => {
            await refresh()
            setIsEditing(false)
          }}
        />
      )}
    </div>
  )
}

interface MetadataCardProps {
  project: ProjectWithAnalyses
}

function MetadataCard({ project }: MetadataCardProps) {
  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Project details
      </h3>
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <DetailRow label="Name" value={project.name} />
        <DetailRow label="Description" value={project.description ?? '—'} />
        <DetailRow label="Repository URL" value={project.repository_url ?? '—'} />
        <DetailRow label="Repository branch" value={project.repository_branch ?? '—'} />
        <DetailRow label="Source type" value={project.source_kind ?? '—'} />
        <DetailRow label="Archive path" value={project.archive_temp_path ?? '—'} />
        <DetailRow label="Created" value={formatTimestamp(project.created_at)} />
        <DetailRow label="Updated" value={formatTimestamp(project.updated_at)} />
      </div>
    </div>
  )
}

interface DetailRowProps {
  label: string
  value: string
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-sm text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  )
}

interface StatusCardProps {
  latestAnalysis: ProjectWithAnalyses['project_analyses'][number] | null
  summary: AnalysisSummary | null
  isLoading: boolean
}

function StatusCard({ latestAnalysis, summary, isLoading }: StatusCardProps) {
  const items = summary ? buildSummaryItems(summary) : []

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Analysis status
      </h3>
      {isLoading && !latestAnalysis ? (
        <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50" />
      ) : latestAnalysis ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusStyles(latestAnalysis.status)}`}>
              {statusLabel(latestAnalysis.status)}
            </span>
            {latestAnalysis.completed_at && (
              <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Completed {formatTimestamp(latestAnalysis.completed_at)}
              </span>
            )}
          </div>
          <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-300">
            {items.length > 0 ? (
              items.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                  <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{item.label}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{item.value}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Analysis summary will appear once the agent completes a run.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No analyses have been run yet. Kick off the first analysis from the onboarding flow.
        </p>
      )}
    </div>
  )
}

interface AnalysisHistorySectionProps {
  analyses: ProjectWithAnalyses['project_analyses']
}

function AnalysisHistorySection({ analyses }: AnalysisHistorySectionProps) {
  if (!analyses || analyses.length === 0) {
    return null
  }

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Analysis history</h2>
        <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {analyses.length} runs
        </span>
      </div>
      <div className="space-y-3">
        {analyses.map((analysis) => (
          <div
            key={analysis.id}
            className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300"
          >
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusStyles(analysis.status)}`}>
                {statusLabel(analysis.status)}
              </span>
              <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {analysis.created_at ? formatTimestamp(analysis.created_at) : '—'}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {analysis.prompt && <span>Prompt: {analysis.prompt}</span>}
              {analysis.source_kind && <span>Source: {analysis.source_kind}</span>}
              {analysis.error_message && (
                <span className="text-rose-500 dark:text-rose-300">Error: {analysis.error_message}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

interface EditProjectDialogProps {
  project: ProjectWithAnalyses
  onClose: () => void
  onSaved: () => Promise<void>
}

function EditProjectDialog({ project, onClose, onSaved }: EditProjectDialogProps) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [repositoryUrl, setRepositoryUrl] = useState(project.repository_url ?? '')
  const [repositoryBranch, setRepositoryBranch] = useState(project.repository_branch ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      await updateProject(project.id, {
        name,
        description,
        repositoryUrl,
        repositoryBranch,
      })
      await onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update project.'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Edit project metadata</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Update the basics so teammates understand how to work with this integration.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="grid gap-5">
          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Repository URL</span>
            <input
              type="url"
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
              placeholder="https://github.com/org/repo"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Repository branch</span>
            <input
              type="text"
              value={repositoryBranch}
              onChange={(event) => setRepositoryBranch(event.target.value)}
              placeholder="main"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

type AnalysisSummary = {
  stats?: { fileCount: number; componentCount: number; apiCount: number }
  tokens?: { name: string; value: string }[]
  components?: { name: string; filePath: string }[]
  endpoints?: { method: string; path: string }[]
  warnings?: { code: string; message: string }[]
  generatedAt?: string
}

function buildSummaryItems(summary: AnalysisSummary) {
  const items: { label: string; value: string }[] = []
  if (summary.stats) {
    items.push({ label: 'Files analyzed', value: String(summary.stats.fileCount) })
    items.push({ label: 'Components', value: String(summary.stats.componentCount) })
    items.push({ label: 'Endpoints', value: String(summary.stats.apiCount) })
  }
  if (summary.tokens && summary.tokens.length > 0) {
    items.push({ label: 'Sample token', value: summary.tokens[0].name })
  }
  if (summary.components && summary.components.length > 0) {
    items.push({ label: 'Sample component', value: summary.components[0].name })
  }
  if (summary.endpoints && summary.endpoints.length > 0) {
    items.push({ label: 'Sample endpoint', value: summary.endpoints[0].path })
  }
  if (summary.warnings && summary.warnings.length > 0) {
    items.push({ label: 'Warnings', value: String(summary.warnings.length) })
  }
  if (summary.generatedAt) {
    items.push({ label: 'Generated', value: formatTimestamp(summary.generatedAt) })
  }
  return items.slice(0, 5)
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

