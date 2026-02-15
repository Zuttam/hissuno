'use client'

import { useState, useCallback, useEffect } from 'react'
import { Dialog, Button, Select, Input, Textarea } from '@/components/ui'
import { SessionTagList } from '@/components/sessions/session-tags'
import type { ProjectRecord } from '@/lib/supabase/projects'
import type { CreateIssueInput, IssueType, IssuePriority } from '@/types/issue'
import type { SessionWithProject } from '@/types/session'

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
  const [availableSessions, setAvailableSessions] = useState<SessionWithProject[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch sessions when project changes
  useEffect(() => {
    if (!projectId || !open) {
      setAvailableSessions([])
      setSelectedSessionIds([])
      return
    }

    const fetchSessions = async () => {
      setIsLoadingSessions(true)
      try {
        const response = await fetch(`/api/projects/${projectId}/sessions?limit=50`)
        if (response.ok) {
          const data = await response.json()
          setAvailableSessions(data.sessions ?? [])
        }
      } catch {
        console.error('[CreateIssueDialog] Failed to fetch sessions')
      } finally {
        setIsLoadingSessions(false)
      }
    }

    void fetchSessions()
  }, [projectId, open])

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
      onClose,
      projects,
    ]
  )

  const formatSessionId = (id: string) => {
    return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id
  }

  const getPathFromUrl = (url: string | null): string => {
    if (!url) return ''
    try {
      const parsedUrl = new URL(url)
      return parsedUrl.pathname.length > 40
        ? `${parsedUrl.pathname.slice(0, 40)}...`
        : parsedUrl.pathname
    } catch {
      return url.length > 40 ? `${url.slice(0, 40)}...` : url
    }
  }

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) {
      return 'Just now'
    } else if (diffMins < 60) {
      return `${diffMins}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const getSessionDisplayTitle = (session: SessionWithProject): string => {
    if (session.page_title) {
      return session.page_title.length > 35
        ? `${session.page_title.slice(0, 35)}...`
        : session.page_title
    }
    const pathFromUrl = getPathFromUrl(session.page_url)
    if (pathFromUrl && pathFromUrl !== '/') {
      return pathFromUrl
    }
    return formatSessionId(session.id)
  }

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
          {isLoadingSessions ? (
            <div className="flex items-center gap-2 text-xs text-[color:var(--text-tertiary)]">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading feedback...
            </div>
          ) : availableSessions.length === 0 ? (
            <p className="text-xs text-[color:var(--text-tertiary)]">
              No feedback found for this project.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)]">
              {availableSessions.map((session) => (
                <label
                  key={session.id}
                  className="flex cursor-pointer items-start gap-3 border-b border-[color:var(--border-subtle)] px-3 py-2 last:border-b-0 hover:bg-[color:var(--surface-hover)]"
                >
                  <input
                    type="checkbox"
                    checked={selectedSessionIds.includes(session.id)}
                    onChange={() => handleToggleSession(session.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-[color:var(--border)] accent-[color:var(--accent-selected)]"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="truncate text-xs font-medium text-[color:var(--foreground)]"
                        title={session.page_title || session.page_url || session.id}
                      >
                        {getSessionDisplayTitle(session)}
                      </span>
                      {session.tags && session.tags.length > 0 && (
                        <div className="shrink-0">
                          <SessionTagList tags={session.tags} size="sm" emptyText="" />
                        </div>
                      )}
                    </div>
                    {session.page_title && session.page_url && (
                      <span className="truncate text-[10px] text-[color:var(--text-tertiary)]">
                        {getPathFromUrl(session.page_url)}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[10px] text-[color:var(--text-tertiary)]">
                    <span>{session.message_count} msg{session.message_count !== 1 ? 's' : ''}</span>
                    <span>{formatRelativeTime(session.last_activity_at)}</span>
                  </div>
                </label>
              ))}
            </div>
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
