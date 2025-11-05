'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProject } from '@/lib/projects/client'

type SourceMode = 'path' | 'upload'

export function ProjectCreateForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [repositoryUrl, setRepositoryUrl] = useState('')
  const [repositoryBranch, setRepositoryBranch] = useState('')
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<SourceMode>('path')
  const [path, setPath] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'analyzing' | 'redirecting'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    setFile(nextFile)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setPhase('preparing')
    setError(null)

    try {
      if (mode === 'path' && path.trim().length === 0) {
        throw new Error('Provide a local path to analyze.')
      }
      if (mode === 'upload' && !file) {
        throw new Error('Upload a .zip archive to analyze.')
      }

      const formData = new FormData()
      formData.append('name', name.trim())
      if (description.trim()) formData.append('description', description.trim())
      if (repositoryUrl.trim()) formData.append('repositoryUrl', repositoryUrl.trim())
      if (repositoryBranch.trim()) formData.append('repositoryBranch', repositoryBranch.trim())
      if (prompt.trim()) formData.append('prompt', prompt.trim())

      if (mode === 'path') {
        formData.append('path', path.trim())
      } else if (file) {
        formData.append('upload', file)
      }

      setPhase('analyzing')
      const payload = await createProject(formData)

      setPhase('redirecting')
      const projectId: string | undefined = payload?.project?.id
      if (projectId) {
        router.push(`/projects/${projectId}/analysis/progress?firstRun=1`)
      } else {
        router.push('/')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project.'
      setError(message)
      setIsSubmitting(false)
      setPhase('idle')
      return
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Create a new project
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Give the agent context and upload your codebase so Customize can extract components and APIs.
          </p>
        </header>

        <div className="grid gap-5">
          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Project name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Acme storefront"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Short blurb so teammates know what this integration covers."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Repository URL (optional)</span>
              <input
                type="url"
                value={repositoryUrl}
                onChange={(event) => setRepositoryUrl(event.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Branch (optional)</span>
              <input
                type="text"
                value={repositoryBranch}
                onChange={(event) => setRepositoryBranch(event.target.value)}
                placeholder="main"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Analyzer prompt (optional)</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
              placeholder="Request a specific focus, component grouping, or API naming convention."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </section>

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
        <header className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Provide source code</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Either reference a local directory accessible to the analyzer or upload a .zip archive.
          </p>
        </header>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setMode('path')}
            className={`flex-1 rounded-xl border px-4 py-2 text-sm transition ${
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
            className={`flex-1 rounded-xl border px-4 py-2 text-sm transition ${
              mode === 'upload'
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300'
            }`}
          >
            Upload .zip
          </button>
        </div>

        {mode === 'path' ? (
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Absolute path
              </span>
              <input
                type="text"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/Users/me/Projects/acme-app"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The analyzer will read files directly from this location. Ensure the runtime has access rights.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Upload archive
              </span>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500"
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Archives are stored in a temp directory so the agent can re-run analyses during onboarding.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-3 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <span className="text-sm">
              {phase === 'preparing'
                ? 'Preparing upload…'
                : phase === 'analyzing'
                  ? 'Analyzing project…'
                  : 'Redirecting…'}
            </span>
          ) : (
            'Create project & analyze'
          )}
        </button>
      </section>
    </form>
  )
}

