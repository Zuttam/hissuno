'use client'

import { useState, useCallback, useRef } from 'react'
import { Dialog, Button, Select, Input, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils/class'
import type { ProjectRecord } from '@/lib/supabase/projects'
import type { CreateSessionInput, SessionTag, CreateMessageInput } from '@/types/session'
import { SESSION_TAGS, SESSION_TAG_INFO } from '@/types/session'

interface CreateSessionDialogProps {
  open: boolean
  onClose: () => void
  projects: ProjectRecord[]
  onCreateSession: (input: CreateSessionInput) => Promise<unknown>
}

type MessageInputMode = 'form' | 'file'

interface MessageEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function CreateSessionDialog({
  open,
  onClose,
  projects,
  onCreateSession,
}: CreateSessionDialogProps) {
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? '')
  const [userId, setUserId] = useState('')
  const [pageUrl, setPageUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [selectedTags, setSelectedTags] = useState<SessionTag[]>([])
  const [messageMode, setMessageMode] = useState<MessageInputMode>('form')
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleToggleTag = useCallback((tag: SessionTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }, [])

  const handleAddMessage = useCallback(() => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: '' },
    ])
  }, [])

  const handleRemoveMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const handleUpdateMessage = useCallback(
    (id: string, field: 'role' | 'content', value: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, [field]: field === 'role' ? (value as 'user' | 'assistant') : value }
            : m
        )
      )
    },
    []
  )

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const parsed = JSON.parse(text)

        // Validate structure
        if (!Array.isArray(parsed)) {
          setError('Invalid file format. Expected an array of messages.')
          return
        }

        const validMessages: MessageEntry[] = parsed
          .filter(
            (msg: { role?: string; content?: string }) =>
              msg.role &&
              (msg.role === 'user' || msg.role === 'assistant') &&
              msg.content &&
              typeof msg.content === 'string'
          )
          .map((msg: { role: 'user' | 'assistant'; content: string }) => ({
            id: crypto.randomUUID(),
            role: msg.role,
            content: msg.content,
          }))

        if (validMessages.length === 0) {
          setError('No valid messages found in the file.')
          // Reset file input on error to allow retry
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          return
        }

        setMessages(validMessages)
        setError(null)
      } catch {
        setError('Failed to parse file. Please ensure it is valid JSON.')
        // Reset file input on error to allow retry
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    []
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!projectId) {
        setError('Please select a project.')
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        // Filter out empty messages
        const validMessages: CreateMessageInput[] = messages
          .filter((m) => m.content.trim())
          .map((m) => ({ role: m.role, content: m.content.trim() }))

        const input: CreateSessionInput = {
          project_id: projectId,
          user_id: userId || undefined,
          page_url: pageUrl || undefined,
          page_title: pageTitle || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          messages: validMessages.length > 0 ? validMessages : undefined,
        }

        const result = await onCreateSession(input)
        if (result) {
          // Reset form and close
          setProjectId(projects[0]?.id ?? '')
          setUserId('')
          setPageUrl('')
          setPageTitle('')
          setSelectedTags([])
          setMessages([])
          setMessageMode('form')
          onClose()
        } else {
          setError('Failed to create session. Please try again.')
        }
      } catch {
        setError('An unexpected error occurred.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      projectId,
      userId,
      pageUrl,
      pageTitle,
      selectedTags,
      messages,
      onCreateSession,
      onClose,
      projects,
    ]
  )

  return (
    <Dialog open={open} onClose={onClose} title="Create Feedback" size="2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-[4px] bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

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
            User ID
          </label>
          <Input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Optional user identifier"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[color:var(--text-secondary)]">
              Page URL
            </label>
            <Input
              type="text"
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="https://example.com/page"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[color:var(--text-secondary)]">
              Page Title
            </label>
            <Input
              type="text"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              placeholder="Optional page title"
            />
          </div>
        </div>

        {/* Tags Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {SESSION_TAGS.map((tag) => {
              const info = SESSION_TAG_INFO[tag]
              const isSelected = selectedTags.includes(tag)
              const variantColor = info.variant === 'info' ? 'primary' : info.variant
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={cn(
                    'rounded-full border-2 px-3 py-1 text-xs font-medium transition',
                    isSelected
                      ? `border-[color:var(--accent-${variantColor})] bg-[color:var(--accent-${variantColor})]/10 text-[color:var(--accent-${variantColor})]`
                      : 'border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:border-[color:var(--border)]'
                  )}
                >
                  {info.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Messages Section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[color:var(--text-secondary)]">
              Messages
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMessageMode('form')}
                className={cn(
                  'rounded-[4px] p-2 transition',
                  messageMode === 'form'
                    ? 'bg-[color:var(--accent-primary)] text-white'
                    : 'bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
                )}
                title="Form input"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setMessageMode('file')}
                className={cn(
                  'rounded-[4px] p-2 transition',
                  messageMode === 'file'
                    ? 'bg-[color:var(--accent-primary)] text-white'
                    : 'bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
                )}
                title="Upload file"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
            </div>
          </div>

          {messageMode === 'form' ? (
            <div className="flex flex-col gap-2">
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className="flex gap-2 rounded-[4px] border-2 border-[color:var(--border-subtle)] p-2"
                >
                  <div className="flex flex-col gap-1">
                    <Select
                      value={msg.role}
                      onChange={(e) =>
                        handleUpdateMessage(msg.id, 'role', e.target.value)
                      }
                      className="w-24"
                    >
                      <option value="user">User</option>
                      <option value="assistant">Assistant</option>
                    </Select>
                    <span className="text-center font-mono text-[10px] text-[color:var(--text-tertiary)]">
                      #{index + 1}
                    </span>
                  </div>
                  <Textarea
                    value={msg.content}
                    onChange={(e) =>
                      handleUpdateMessage(msg.id, 'content', e.target.value)
                    }
                    placeholder="Message content..."
                    rows={2}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveMessage(msg.id)}
                    className="self-start rounded-[4px] p-1 text-[color:var(--text-tertiary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-danger)]"
                    aria-label="Remove message"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddMessage}
                className="flex items-center justify-center gap-1 rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] px-3 py-2 text-xs text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--foreground)]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Message
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-[color:var(--text-tertiary)]">
                Upload a JSON file with an array of messages. Each message should
                have &quot;role&quot; (user/assistant) and &quot;content&quot; fields.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--foreground)] file:mr-3 file:rounded-[4px] file:border-0 file:bg-[color:var(--accent-primary)] file:px-3 file:py-1 file:text-xs file:text-white"
              />
              {messages.length > 0 && (
                <p className="text-xs text-[color:var(--accent-success)]">
                  Loaded {messages.length} messages from file
                </p>
              )}
            </div>
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
