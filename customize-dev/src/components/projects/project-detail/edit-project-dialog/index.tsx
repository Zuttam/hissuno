'use client'

import { FormEvent, useState } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { updateProject } from '@/lib/projects/client'
import { Alert, Button, FormField, Input, SectionHeader, Textarea } from '@/components/ui'

interface EditProjectDialogProps {
  project: ProjectWithCodebase
  onClose: () => void
  onSaved: () => Promise<void>
}

export function EditProjectDialog({ project, onClose, onSaved }: EditProjectDialogProps) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const trimmedDescription = description.trim()
      const projectPayload: Record<string, unknown> = {}

      if (name !== project.name) {
        projectPayload.name = name
      }

      if ((project.description ?? '') !== trimmedDescription) {
        projectPayload.description = trimmedDescription
      }

      if (Object.keys(projectPayload).length === 0) {
        setIsSaving(false)
        onClose()
        return
      }

      await updateProject(project.id, projectPayload)
      await onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update project.'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm max-h-screen overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <SectionHeader
          title="Edit project"
          description="Update your project name and description."
        />

        <div className="grid gap-5">
          <FormField label="Name">
            <Input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </FormField>

          {project.source_code && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-slate-700 dark:text-slate-100">Source Code</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Type: {project.source_code.kind ?? '—'}
                </p>
                {project.source_code.storage_uri && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Storage: {project.source_code.storage_uri}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

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
