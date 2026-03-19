'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Dialog, Button, Input, Textarea, Select } from '@/components/ui'
import { Combobox, type ComboboxItem } from '@/components/ui/combobox'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { cn } from '@/lib/utils/class'
import { fetchApi, buildUrl } from '@/lib/api/fetch'
import { createContact } from '@/lib/api/contacts'
import type { ProjectRow } from '@/lib/db/queries/projects'
import type { CreateSessionInput, SessionTag, CreateMessageInput, SessionType } from '@/types/session'
import { SESSION_TAGS, SESSION_TAG_INFO, SESSION_TYPE_INFO } from '@/types/session'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateSessionDialogProps {
  open: boolean
  onClose: () => void
  projects: ProjectRow[]
  onCreateSession: (input: CreateSessionInput) => Promise<unknown>
}

type MessageInputMode = 'form' | 'file'
type FeedbackMode = SessionType | 'custom'

interface MessageEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface LinkedItem {
  value: string
  label: string
}

// ---------------------------------------------------------------------------
// EntityLinkField helper
// ---------------------------------------------------------------------------

function EntityLinkField({
  label,
  projectId,
  entityType,
  items,
  onAdd,
  onRemove,
}: {
  label: string
  projectId: string
  entityType: 'company' | 'issue' | 'knowledge_source' | 'product_scope'
  items: LinkedItem[]
  onAdd: (item: LinkedItem) => void
  onRemove: (value: string) => void
}) {
  const labelMapRef = useRef(new Map<string, string>())

  const searchFn = useCallback(
    async (query: string): Promise<ComboboxItem[]> => {
      try {
        const existingIds = new Set(items.map((i) => i.value))
        let results: ComboboxItem[] = []

        switch (entityType) {
          case 'company': {
            const data = await fetchApi<{ companies: Array<{ id: string; name: string }> }>(
              buildUrl('/api/companies', { projectId, search: query, limit: 10 }),
            )
            results = (data.companies ?? []).map((c) => ({ value: c.id, label: c.name }))
            break
          }
          case 'issue': {
            const data = await fetchApi<{ issues: Array<{ id: string; title: string }> }>(
              buildUrl('/api/issues', { projectId, search: query, limit: 10 }),
            )
            results = (data.issues ?? []).map((i) => ({ value: i.id, label: i.title }))
            break
          }
          case 'knowledge_source': {
            const data = await fetchApi<{ sources: Array<{ id: string; name: string | null }> }>(
              buildUrl('/api/knowledge/sources', { projectId, search: query }),
            )
            results = (data.sources ?? []).map((k) => ({ value: k.id, label: k.name || 'Unnamed' }))
            break
          }
          case 'product_scope': {
            const data = await fetchApi<{ productScopes: Array<{ id: string; name: string }> }>(
              buildUrl('/api/product-scopes', { projectId }),
            )
            const lower = query.toLowerCase()
            results = (data.productScopes ?? [])
              .filter((p) => p.name.toLowerCase().includes(lower))
              .map((p) => ({ value: p.id, label: p.name }))
            break
          }
        }

        // Cache labels and filter out already-linked
        for (const r of results) labelMapRef.current.set(r.value, r.label)
        return results.filter((r) => !existingIds.has(r.value))
      } catch {
        return []
      }
    },
    [projectId, entityType, items],
  )

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wide text-[color:var(--text-secondary)]">
        {label}
      </span>
      <Combobox
        items={[]}
        onSearch={searchFn}
        value={undefined}
        onValueChange={(val) => {
          if (val) {
            const itemLabel = labelMapRef.current.get(val) ?? val
            onAdd({ value: val, label: itemLabel })
          }
        }}
        placeholder={`Search ${label.toLowerCase()}...`}
        emptyMessage="No results"
        size="sm"
      />
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <span
              key={item.value}
              className="flex items-center gap-1 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-2 py-0.5 text-[10px] text-[color:var(--foreground)]"
            >
              <span className="max-w-[160px] truncate">{item.label}</span>
              <button
                type="button"
                onClick={() => onRemove(item.value)}
                className="text-[color:var(--text-tertiary)] hover:text-[color:var(--accent-danger)]"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feedback mode config (module-level constant)
// ---------------------------------------------------------------------------

const feedbackModes: { value: FeedbackMode; label: string; variant: string }[] = [
  { value: 'chat', label: SESSION_TYPE_INFO.chat.label, variant: 'info' },
  { value: 'meeting', label: SESSION_TYPE_INFO.meeting.label, variant: 'success' },
  { value: 'behavioral', label: SESSION_TYPE_INFO.behavioral.label, variant: 'warning' },
  { value: 'custom', label: 'Custom', variant: 'default' },
]

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function CreateSessionDialog({
  open,
  onClose,
  projects,
  onCreateSession,
}: CreateSessionDialogProps) {
  const projectId = projects[0]?.id ?? ''
  const projectName = projects[0]?.name ?? 'No project'

  // Core fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('chat')
  const [selectedTags, setSelectedTags] = useState<SessionTag[]>([])

  // Customer
  const [selectedContactId, setSelectedContactId] = useState<string | undefined>(undefined)
  const [showCreateContact, setShowCreateContact] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newContactEmail, setNewContactEmail] = useState('')
  const [isCreatingContact, setIsCreatingContact] = useState(false)

  // Content
  const [messageMode, setMessageMode] = useState<MessageInputMode>('form')
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [transcriptContent, setTranscriptContent] = useState('')
  const [customContent, setCustomContent] = useState('')

  // Page details
  const [pageUrl, setPageUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('')

  // Related entities
  const [linkedCompanies, setLinkedCompanies] = useState<LinkedItem[]>([])
  const [linkedIssues, setLinkedIssues] = useState<LinkedItem[]>([])
  const [linkedKnowledge, setLinkedKnowledge] = useState<LinkedItem[]>([])
  const [linkedScopes, setLinkedScopes] = useState<LinkedItem[]>([])

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Contact label cache for combobox
  const contactLabelRef = useRef(new Map<string, string>())

  // ---- Handlers ----

  const resetForm = useCallback(() => {
    setName('')
    setDescription('')
    setFeedbackMode('chat')
    setSelectedTags([])
    setSelectedContactId(undefined)
    setShowCreateContact(false)
    setNewContactName('')
    setNewContactEmail('')
    setMessageMode('form')
    setMessages([])
    setTranscriptContent('')
    setCustomContent('')
    setPageUrl('')
    setPageTitle('')
    setLinkedCompanies([])
    setLinkedIssues([])
    setLinkedKnowledge([])
    setLinkedScopes([])
    setError(null)
    contactLabelRef.current.clear()
  }, [])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) resetForm()
  }, [open, resetForm])

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
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }
        setMessages(validMessages)
        setError(null)
      } catch {
        setError('Failed to parse file. Please ensure it is valid JSON.')
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    []
  )

  const searchContacts = useCallback(
    async (query: string): Promise<ComboboxItem[]> => {
      try {
        const data = await fetchApi<{ contacts: Array<{ id: string; name: string }> }>(
          buildUrl('/api/contacts', { projectId, search: query, limit: 10 }),
        )
        const results = (data.contacts ?? []).map((c) => ({ value: c.id, label: c.name }))
        for (const r of results) contactLabelRef.current.set(r.value, r.label)
        return results
      } catch {
        return []
      }
    },
    [projectId],
  )

  const handleCreateContact = useCallback(async () => {
    if (!newContactName.trim() || !newContactEmail.trim()) return
    setIsCreatingContact(true)
    try {
      const result = await createContact(projectId, {
        project_id: projectId,
        name: newContactName.trim(),
        email: newContactEmail.trim(),
      })
      const c = result.contact
      contactLabelRef.current.set(c.id, c.name)
      setSelectedContactId(c.id)
      setShowCreateContact(false)
      setNewContactName('')
      setNewContactEmail('')
    } catch {
      setError('Failed to create contact.')
    } finally {
      setIsCreatingContact(false)
    }
  }, [projectId, newContactName, newContactEmail])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!name.trim()) {
        setError('Name is required.')
        return
      }
      if (!description.trim()) {
        setError('Description is required.')
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        // Build messages based on feedback mode
        let validMessages: CreateMessageInput[] = []
        if (feedbackMode === 'chat') {
          validMessages = messages
            .filter((m) => m.content.trim())
            .map((m) => ({ role: m.role, content: m.content.trim() }))
        } else if (feedbackMode === 'meeting' || feedbackMode === 'behavioral') {
          if (transcriptContent.trim()) {
            validMessages = [{ role: 'user', content: transcriptContent.trim() }]
          }
        } else {
          // custom
          if (customContent.trim()) {
            validMessages = [{ role: 'user', content: customContent.trim() }]
          }
        }

        // Map feedback mode to session_type
        const sessionType: SessionType = feedbackMode === 'custom' ? 'chat' : feedbackMode

        // Build linked_entities
        const linked_entities: CreateSessionInput['linked_entities'] = {}
        if (linkedCompanies.length > 0) linked_entities.companies = linkedCompanies.map((i) => i.value)
        if (linkedIssues.length > 0) linked_entities.issues = linkedIssues.map((i) => i.value)
        if (linkedKnowledge.length > 0) linked_entities.knowledge_sources = linkedKnowledge.map((i) => i.value)
        if (linkedScopes.length > 0) linked_entities.product_scopes = linkedScopes.map((i) => i.value)
        const hasLinkedEntities = Object.keys(linked_entities).length > 0

        const input: CreateSessionInput = {
          project_id: projectId,
          name: name.trim(),
          description: description.trim(),
          session_type: sessionType,
          contact_id: selectedContactId || undefined,
          linked_entities: hasLinkedEntities ? linked_entities : undefined,
          page_url: pageUrl || undefined,
          page_title: pageTitle || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          messages: validMessages.length > 0 ? validMessages : undefined,
        }

        const result = await onCreateSession(input)
        if (result) {
          resetForm()
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
      name,
      description,
      feedbackMode,
      messages,
      transcriptContent,
      customContent,
      selectedContactId,
      linkedCompanies,
      linkedIssues,
      linkedKnowledge,
      linkedScopes,
      pageUrl,
      pageTitle,
      selectedTags,
      projectId,
      onCreateSession,
      onClose,
      resetForm,
    ]
  )

  const selectedContactLabel = selectedContactId
    ? contactLabelRef.current.get(selectedContactId) ?? undefined
    : undefined

  return (
    <Dialog open={open} onClose={onClose} title="Create Feedback" size="xxl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-[4px] bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Project (read-only) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">
            Project
          </label>
          <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]">
            {projectName}
          </div>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">
            Name *
          </label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Feedback name"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">
            Description *
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this feedback"
            rows={2}
          />
        </div>

        {/* Customer */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[color:var(--text-secondary)]">
              Customer
            </label>
            <button
              type="button"
              onClick={() => setShowCreateContact(!showCreateContact)}
              className="font-mono text-[10px] text-[color:var(--accent-primary)] hover:underline"
            >
              {showCreateContact ? 'Cancel' : '+ New contact'}
            </button>
          </div>
          {showCreateContact ? (
            <div className="flex flex-col gap-2 rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] p-3">
              <Input
                type="text"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="Name"
              />
              <Input
                type="email"
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
                placeholder="Email"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCreateContact}
                loading={isCreatingContact}
                disabled={!newContactName.trim() || !newContactEmail.trim()}
              >
                Create Contact
              </Button>
            </div>
          ) : (
            <Combobox
              items={selectedContactId && selectedContactLabel
                ? [{ value: selectedContactId, label: selectedContactLabel }]
                : []
              }
              onSearch={searchContacts}
              value={selectedContactId}
              onValueChange={(val) => setSelectedContactId(val)}
              placeholder="Search contacts..."
              emptyMessage="No contacts found"
            />
          )}
        </div>

        {/* Feedback Type */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">
            Feedback Type
          </label>
          <div className="flex flex-wrap gap-2">
            {feedbackModes.map((mode) => {
              const isSelected = feedbackMode === mode.value
              const variantColor = mode.variant === 'info' ? 'primary' : mode.variant
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setFeedbackMode(mode.value)}
                  className={cn(
                    'rounded-full border-2 px-3 py-1 text-xs font-medium transition',
                    isSelected
                      ? `border-[color:var(--accent-${variantColor})] bg-[color:var(--accent-${variantColor})]/10 text-[color:var(--accent-${variantColor})]`
                      : 'border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:border-[color:var(--border)]'
                  )}
                >
                  {mode.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content area - varies by feedback type */}
        <div className="flex flex-col gap-2">
          {feedbackMode === 'chat' ? (
            <>
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
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            </>
          ) : feedbackMode === 'meeting' ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[color:var(--text-secondary)]">
                Transcript
              </label>
              <Textarea
                value={transcriptContent}
                onChange={(e) => setTranscriptContent(e.target.value)}
                placeholder="Paste meeting transcript..."
                rows={6}
              />
            </div>
          ) : feedbackMode === 'behavioral' ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[color:var(--text-secondary)]">
                Events
              </label>
              <Textarea
                value={transcriptContent}
                onChange={(e) => setTranscriptContent(e.target.value)}
                placeholder="Paste behavioral events..."
                rows={6}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[color:var(--text-secondary)]">
                Content
              </label>
              <Textarea
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                placeholder="Paste feedback content..."
                rows={6}
              />
            </div>
          )}
        </div>

        {/* Tags */}
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

        {/* Related Entities */}
        <CollapsibleSection title="Related Entities" defaultExpanded={false}>
          <div className="flex flex-col gap-3">
            <EntityLinkField
              label="Companies"
              projectId={projectId}
              entityType="company"
              items={linkedCompanies}
              onAdd={(item) => setLinkedCompanies((prev) => [...prev, item])}
              onRemove={(val) => setLinkedCompanies((prev) => prev.filter((i) => i.value !== val))}
            />
            <EntityLinkField
              label="Issues"
              projectId={projectId}
              entityType="issue"
              items={linkedIssues}
              onAdd={(item) => setLinkedIssues((prev) => [...prev, item])}
              onRemove={(val) => setLinkedIssues((prev) => prev.filter((i) => i.value !== val))}
            />
            <EntityLinkField
              label="Knowledge Sources"
              projectId={projectId}
              entityType="knowledge_source"
              items={linkedKnowledge}
              onAdd={(item) => setLinkedKnowledge((prev) => [...prev, item])}
              onRemove={(val) => setLinkedKnowledge((prev) => prev.filter((i) => i.value !== val))}
            />
            <EntityLinkField
              label="Product Scopes"
              projectId={projectId}
              entityType="product_scope"
              items={linkedScopes}
              onAdd={(item) => setLinkedScopes((prev) => [...prev, item])}
              onRemove={(val) => setLinkedScopes((prev) => prev.filter((i) => i.value !== val))}
            />
          </div>
        </CollapsibleSection>

        {/* Page Details */}
        <CollapsibleSection title="Page Details" defaultExpanded={false}>
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
        </CollapsibleSection>

        {/* Actions */}
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
