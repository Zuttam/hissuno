'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { AnalyzerHistoryItem, AnalyzerResponse } from '@/types/analyzer'
import type { ProjectWithAnalyses } from '@/lib/supabase/projects'
import { triggerAnalysis } from '@/lib/projects/client'
import { useProjectDetail } from '@/hooks/use-projects'
import { AnalysisTabs } from './analysis-tabs'
import { HistoryPanel } from './history-panel'
import { LoadingIndicator } from './loading-indicator'
import { UploadPanel } from './upload-panel'

interface ProjectAnalysisEditorProps {
  projectId: string
  initialProject: ProjectWithAnalyses
}

export function ProjectAnalysisEditor({ projectId, initialProject }: ProjectAnalysisEditorProps) {
  const { project, latestAnalysis, isLoading, error, refresh } = useProjectDetail({
    projectId,
    initialProject,
    autoRefresh: true,
  })
  const [prefillPrompt, setPrefillPrompt] = useState('')
  const [selectedTab, setSelectedTab] = useState<'design' | 'api'>('design')
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(
    initialProject.project_analyses?.[0]?.id ?? null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [prefillKey, setPrefillKey] = useState(0)

  const analyses = useMemo(() => {
    const hydrated = project?.project_analyses ?? initialProject.project_analyses ?? []
    return hydrated
  }, [project?.project_analyses, initialProject.project_analyses])

  const activeAnalysis = useMemo(() => {
    if (!selectedAnalysisId) {
      return latestAnalysis ?? null
    }
    return analyses.find((analysis) => analysis.id === selectedAnalysisId) ?? latestAnalysis ?? null
  }, [analyses, latestAnalysis, selectedAnalysisId])

  const activeResponse = useMemo(() => {
    if (!activeAnalysis?.result) return null
    return activeAnalysis.result as unknown as AnalyzerResponse
  }, [activeAnalysis])

  const historyItems = useMemo<AnalyzerHistoryItem[]>(() => {
    return analyses.map((analysis) => ({
      id: analysis.id,
      prompt: analysis.prompt ?? undefined,
      source:
        analysis.source_kind === 'path'
          ? { kind: 'path', value: analysis.source_value ?? '' }
          : { kind: 'upload', filename: extractFilename(analysis.source_value) },
      requestedAt: analysis.created_at ?? new Date().toISOString(),
    }))
  }, [analyses])

  const handleHistorySelect = (item: AnalyzerHistoryItem) => {
    setPrefillPrompt(item.prompt ?? '')
    setPrefillKey((value) => value + 1)
    setSelectedAnalysisId(item.id)
    setSelectedTab('design')
  }

  const handleAnalyze = async ({ prompt, path, file }: { prompt?: string; path?: string; file?: File | null }) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const formData = new FormData()
      if (prompt) formData.append('prompt', prompt)
      if (path) formData.append('path', path)
      if (file) formData.append('upload', file)

      const response = await triggerAnalysis(projectId, formData)
      const analysis = response.analysis
      if (analysis?.id) {
        setSelectedAnalysisId(analysis.id)
      }
      setSelectedTab('design')
      setPrefillPrompt(prompt ?? '')
      setPrefillKey((value) => value + 1)
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed to run.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeStatus = activeAnalysis?.status ?? 'pending'

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <aside className="flex w-full max-w-md flex-col border-r border-slate-200 bg-white/70 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/70">
        <div className="space-y-2 px-6 py-6">
          <Link href={`/projects/${projectId}`} className="text-xs uppercase tracking-wide text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white">
            ← Back to project
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {project?.name ?? initialProject.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Iterate on prompts, re-run analyses, and review historical runs.
          </p>
        </div>
        {error && (
          <div className="mx-6 mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </div>
        )}
        <UploadPanel
          key={prefillKey}
          onAnalyze={handleAnalyze}
          isLoading={isSubmitting}
          error={submitError}
          prefillPrompt={prefillPrompt}
        />
        <HistoryPanel history={historyItems} onSelect={handleHistorySelect} selectedId={activeAnalysis?.id} />
      </aside>

      <main className="relative flex flex-1 flex-col">
        {(isSubmitting || activeStatus === 'running') && <LoadingIndicator message={isSubmitting ? 'Running analysis…' : 'Analysis in progress…'} />}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-8 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              {activeResponse ? 'Analysis output' : 'Awaiting analysis'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {activeResponse
                ? 'Switch between design system insights and API surface.'
                : 'Run an analysis to see your design system and API definitions here.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusStyles(activeStatus)}`}>
              {statusLabel(activeStatus)}
            </span>
            {activeAnalysis?.completed_at && (
              <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Completed {formatTimestamp(activeAnalysis.completed_at)}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white/60 px-8 py-6 dark:bg-slate-950/70">
          {activeResponse ? (
            <AnalysisTabs analysis={activeResponse} selectedTab={selectedTab} onTabChange={setSelectedTab} />
          ) : isLoading ? (
            <div className="h-full rounded-3xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/70 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              Trigger an analysis to view the generated insights here.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function extractFilename(value: string | null) {
  if (!value) return 'archive.zip'
  const segments = value.split('/')
  const last = segments[segments.length - 1]
  return last || value
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

