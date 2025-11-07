'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

type Mode = 'path' | 'upload'

interface UploadPanelProps {
  onAnalyze: (input: { prompt?: string; path?: string; file?: File | null }) => Promise<void>
  isLoading: boolean
  error: string | null
  prefillPrompt?: string
}

export function UploadPanel({ onAnalyze, isLoading, error, prefillPrompt }: UploadPanelProps) {
  const [mode, setMode] = useState<Mode>('path')
  const [prompt, setPrompt] = useState(prefillPrompt ?? '')
  const [path, setPath] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0]
    setFile(nextFile ?? null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onAnalyze({
      prompt: prompt.trim() || undefined,
      path: mode === 'path' ? path.trim() || undefined : undefined,
      file: mode === 'upload' ? file : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 px-6 pb-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Prompt the analyzer
        </label>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask for component groupings, API summaries, or follow-up tweaks…"
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Choose source</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setMode('path')}
            className={`flex-1 rounded-lg border px-4 py-2 text-sm transition ${
              mode === 'path'
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300'
            }`}
          >
            Local path
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`flex-1 rounded-lg border px-4 py-2 text-sm transition ${
              mode === 'upload'
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300'
            }`}
          >
            Upload .zip
          </button>
        </div>

        {mode === 'path' ? (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Project directory path
            </label>
            <input
              type="text"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="/Users/you/Projects/acme-app"
              className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The server will inspect the files directly. Make sure the path is accessible.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Upload project archive (.zip)
            </label>
            <input
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Archives are staged temporarily for analysis and removed immediately after.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Analyzing…' : 'Run analysis'}
      </button>
    </form>
  )
}

