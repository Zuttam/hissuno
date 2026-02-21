'use client'

import { useState, useCallback, useEffect } from 'react'
import { Dialog, Button, Select, Input, Textarea } from '@/components/ui'
import { SessionPicker } from '@/components/sessions/session-picker'
import type { ProjectRecord } from '@/lib/supabase/projects'
import type { CreateIssueInput, IssueType, IssuePriority } from '@/types/issue'

interface CreateIssueDialogProps {
  open: boolean
  onClose: () => void
  projects: ProjectRecord[]
  onCreateIssue: (input: CreateIssueInput) => Promise<unknown>
}

export function CreateIssueDialog({
  open,
  onClose,
  projects,
  onCreateIssue,
}: CreateIssueDialogProps) {
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? '')
  const [type, setType] = useState<IssueType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<IssuePriority>('low')
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Clear selected sessions when project changes
  useEffect(() => {
    setSelectedSessionIds([])
  }, [projectId])

  const handleToggleSession = useCallback((sessionId: string) => {
    setSelectedSessionIds((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    )
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!projectId) {
        setError('Please select a project.')
        return
      }
      if (!title.trim()) {
        setError('Please enter a title.')
        return
      }
      if (!description.trim()) {
        setError('Please enter a description.')
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        const input: CreateIssueInput = {
          project_id: projectId,
          session_ids: selectedSessionIds.length > 0 ? selectedSessionIds : undefined,
          type,
          title: title.trim(),
          description: description.trim(),
          priority,
        }

        const result = await onCreateIssue(input)
        if (result) {
          // Reset form for next issue
          setType('bug')
          setTitle('')
          setDescription('')
          setPriority('low')
          setSelectedSessionIds([])
        } else {
          setError('Failed to create issue. Please try again.')
        }
      } catch {
        setError('An unexpected error occurred.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      projectId,
      type,
      title,
      description,
      priority,
      selectedSessionIds,
      onCreateIssue,
    ]
  )

  return (
    <Dialog open={open} onClose={onClose} title="Create Issue" size="xxl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-[4px] bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[color:var(--text-secondary)]">
              Project *
            </label>
            <Select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[color:var(--text-secondary)]">
              Type *
            </label>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as IssueType)}
            >
              <option value="bug">Bug</option>
              <option value="feature_request">Feature Request</option>
              <option value="change_request">Change Request</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">
            Title *
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief summary of the issue"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">
            Description *
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of the issue"
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">
            Priority
          </label>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value as IssuePriority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>

        {/* Sessions Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">
            Linked feedback
          </label>
          {open && projectId && (
            <SessionPicker
              projectId={projectId}
              selectedSessionIds={selectedSessionIds}
              onToggleSession={handleToggleSession}
            />
          )}
          {selectedSessionIds.length > 0 && (
            <p className="text-xs text-[color:var(--accent-success)]">
              {selectedSessionIds.length} session{selectedSessionIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
