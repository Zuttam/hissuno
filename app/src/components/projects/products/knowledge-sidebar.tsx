'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Globe,
  BookOpen,
  FileText,
  Type,
  StickyNote,
  Folder,
  ExternalLink,
} from 'lucide-react'
import { Button, Dialog, Input, Textarea, Spinner, Badge } from '@/components/ui'
import { CustomFieldsRenderer } from '@/components/shared/custom-fields-renderer'
import { useCustomFields } from '@/hooks/use-custom-fields'
import { fetchApi, buildUrl } from '@/lib/api/fetch'
import { formatRelativeTime } from '@/lib/utils/format-time'
import {
  type KnowledgeSourceType,
  type KnowledgeSourceStatus,
  getSourceTypeLabel,
} from '@/lib/knowledge/types'

const MAX_NAME_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 1000

interface KnowledgeSourceDetail {
  id: string
  project_id: string
  type: KnowledgeSourceType
  status: KnowledgeSourceStatus
  name: string | null
  description: string | null
  url: string | null
  content: string | null
  analysis_scope: string | null
  enabled: boolean
  custom_fields: Record<string, unknown> | null
  parent_id: string | null
  notion_page_id: string | null
  storage_path: string | null
  analyzed_at: string | null
  error_message: string | null
  created_at: string | null
  updated_at: string | null
  product_scope_id: string
}

const USER_ADDABLE_TYPES: KnowledgeSourceType[] = [
  'website',
  'docs_portal',
  'raw_text',
]

function useSidebarDismiss(onClose: () => void) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])
}

export function KnowledgeTypeIcon({ type, size = 14 }: { type: KnowledgeSourceType; size?: number }) {
  const className = 'text-[color:var(--text-secondary)]'
  if (type === 'website') return <Globe size={size} className={className} />
  if (type === 'docs_portal') return <BookOpen size={size} className={className} />
  if (type === 'uploaded_doc') return <FileText size={size} className={className} />
  if (type === 'raw_text') return <Type size={size} className={className} />
  if (type === 'notion') return <StickyNote size={size} className={className} />
  return <Folder size={size} className={className} />
}

function statusVariant(status: KnowledgeSourceStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'done') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'analyzing') return 'info'
  return 'warning'
}

interface KnowledgeSidebarEditProps {
  mode: 'edit'
  projectId: string
  scopeId: string
  sourceId: string
  onClose: () => void
  onChange: () => void
  onDeleted: () => void
}

interface KnowledgeSidebarCreateProps {
  mode: 'create'
  projectId: string
  scopeId: string
  onClose: () => void
  onCreated: (newSourceId: string) => void
}

export type KnowledgeSidebarProps = KnowledgeSidebarEditProps | KnowledgeSidebarCreateProps

export function KnowledgeSidebar(props: KnowledgeSidebarProps) {
  if (props.mode === 'create') {
    return <CreateModeSidebar {...props} />
  }
  return <EditModeSidebar {...props} />
}

function EditModeSidebar({
  projectId,
  scopeId,
  sourceId,
  onClose,
  onChange,
  onDeleted,
}: KnowledgeSidebarEditProps) {
  const [source, setSource] = useState<KnowledgeSourceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useSidebarDismiss(onClose)

  const { fields: customFields } = useCustomFields({
    projectId,
    entityType: 'knowledge_source',
  })

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true)
      setLoadError(null)
      const data = await fetchApi<{ source: KnowledgeSourceDetail }>(
        buildUrl(`/api/product-scopes/${scopeId}/knowledge/${sourceId}`, { projectId }),
      )
      setSource(data.source)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load knowledge source.')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, scopeId, sourceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const patch = useCallback(
    async (updates: Record<string, unknown>): Promise<boolean> => {
      try {
        const data = await fetchApi<{ source: KnowledgeSourceDetail }>(
          buildUrl(`/api/product-scopes/${scopeId}/knowledge/${sourceId}`, { projectId }),
          { method: 'PATCH', body: updates },
        )
        setSource(data.source)
        onChange()
        return true
      } catch (err) {
        console.error('[knowledge-sidebar] patch failed:', err)
        return false
      }
    },
    [projectId, scopeId, sourceId, onChange],
  )

  const handleDelete = useCallback(async () => {
    if (!source) return
    setIsDeleting(true)
    try {
      await fetchApi(
        buildUrl(`/api/product-scopes/${scopeId}/knowledge/${sourceId}`, {
          projectId,
          children: 'reparent',
        }),
        { method: 'DELETE' },
      )
      onDeleted()
    } catch (err) {
      console.error('[knowledge-sidebar] delete failed:', err)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }, [projectId, scopeId, sourceId, source, onDeleted])

  const handleCustomFieldChange = useCallback(
    (key: string, value: unknown) => {
      if (!source) return
      const next = { ...(source.custom_fields ?? {}), [key]: value }
      void patch({ custom_fields: next })
    },
    [source, patch],
  )

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        {/* Header */}
        <div className="shrink-0 border-b-2 border-[color:var(--border-subtle)] p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              Knowledge
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] p-2 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
              aria-label="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 pt-3"><Spinner size="sm" /><span className="text-sm text-[color:var(--text-secondary)]">Loading...</span></div>
          ) : loadError ? (
            <p className="pt-3 text-sm text-[color:var(--accent-danger)]">{loadError}</p>
          ) : source ? (
            <>
              {/* Name */}
              <EditableName
                value={source.name}
                onSave={async (newValue) => patch({ name: newValue })}
              />

              {/* Description */}
              <div className="mt-2">
                <EditableTextField
                  value={source.description}
                  onSave={(newValue) => patch({ description: newValue })}
                  placeholder="Add a description..."
                  type="textarea"
                  maxLength={MAX_DESCRIPTION_LENGTH}
                />
              </div>

              {/* Type / status / enabled / delete */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)]">
                  <KnowledgeTypeIcon type={source.type} />
                  <span>{getSourceTypeLabel(source.type)}</span>
                </span>
                <Badge variant={statusVariant(source.status)}>{source.status}</Badge>
                <button
                  type="button"
                  onClick={() => void patch({ enabled: !source.enabled })}
                  className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${source.enabled ? 'bg-[color:var(--accent-success)]' : 'bg-[color:var(--text-tertiary)]'}`} />
                  {source.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-danger)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Delete</span>
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* Body */}
        {source && !isLoading && !loadError && (
          <div className="flex-1 overflow-y-auto">
            {/* URL (websites/docs) */}
            {(source.type === 'website' || source.type === 'docs_portal') && (
              <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
                <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">URL</span>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 break-all text-sm text-[color:var(--accent-primary)] hover:underline"
                  >
                    {source.url}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <p className="text-sm text-[color:var(--text-tertiary)]">No URL</p>
                )}
              </div>
            )}

            {/* Storage path (uploaded_doc) */}
            {source.type === 'uploaded_doc' && source.storage_path && (
              <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
                <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">File</span>
                <p className="break-all text-sm text-[color:var(--foreground)]">
                  {source.storage_path.split('/').pop()}
                </p>
              </div>
            )}

            {/* Notion page id */}
            {source.type === 'notion' && source.notion_page_id && (
              <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
                <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">Notion page</span>
                <p className="break-all font-mono text-xs text-[color:var(--foreground)]">{source.notion_page_id}</p>
              </div>
            )}

            {/* Content (raw_text) */}
            {source.type === 'raw_text' && (
              <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
                <EditableTextField
                  value={source.content}
                  onSave={(newValue) => patch({ content: newValue })}
                  placeholder="Add content..."
                  type="textarea"
                  maxLength={50000}
                  label="Content"
                />
              </div>
            )}

            {/* Analysis scope */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <EditableTextField
                value={source.analysis_scope}
                onSave={(newValue) => patch({ analysis_scope: newValue })}
                placeholder="What should be extracted from this source?"
                type="textarea"
                maxLength={1000}
                label="Analysis scope"
              />
            </div>

            {/* Custom fields */}
            {customFields.length > 0 && (
              <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
                <CustomFieldsRenderer
                  fields={customFields}
                  values={(source.custom_fields ?? {}) as Record<string, unknown>}
                  onChange={handleCustomFieldChange}
                />
              </div>
            )}

            {/* Metadata */}
            <div className="flex flex-col gap-2 p-4 text-xs text-[color:var(--text-tertiary)]">
              {source.error_message && (
                <p className="text-[color:var(--accent-danger)]">{source.error_message}</p>
              )}
              {source.analyzed_at && <p>Analyzed {formatRelativeTime(source.analyzed_at)}</p>}
              {source.created_at && <p>Created {formatRelativeTime(source.created_at)}</p>}
            </div>
          </div>
        )}
      </aside>

      {/* Delete confirmation */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete knowledge source"
        size="md"
      >
        <p className="text-sm text-[color:var(--text-secondary)]">
          Are you sure you want to delete &quot;{source?.name || 'this source'}&quot;? Any nested children will be reparented.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => void handleDelete()} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Dialog>
    </>
  )
}

function CreateModeSidebar({
  projectId,
  scopeId,
  onClose,
  onCreated,
}: KnowledgeSidebarCreateProps) {
  const [type, setType] = useState<KnowledgeSourceType>('website')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useSidebarDismiss(onClose)

  const canSave = useMemo(() => {
    if (type === 'website' || type === 'docs_portal') return Boolean(url.trim())
    if (type === 'raw_text') return Boolean(content.trim())
    return false
  }, [type, url, content])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        type,
        name: name.trim() || null,
        description: description.trim() || null,
      }
      if (type === 'website' || type === 'docs_portal') payload.url = url.trim()
      if (type === 'raw_text') payload.content = content
      const data = await fetchApi<{ source: { id: string } }>(
        buildUrl(`/api/product-scopes/${scopeId}/knowledge`, { projectId }),
        { method: 'POST', body: payload },
      )
      onCreated(data.source.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create knowledge source.')
    } finally {
      setIsSaving(false)
    }
  }, [type, name, description, url, content, projectId, scopeId, onCreated])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        <div className="shrink-0 border-b-2 border-[color:var(--border-subtle)] p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              New knowledge
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] p-2 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
              aria-label="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* Type selector */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {USER_ADDABLE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex items-center gap-2 rounded-[4px] border px-3 py-2 text-sm transition ${
                    type === t
                      ? 'border-[color:var(--accent-selected)] bg-[color:var(--surface-selected)] text-[color:var(--foreground)]'
                      : 'border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
                  }`}
                >
                  <KnowledgeTypeIcon type={t} />
                  <span>{getSourceTypeLabel(t)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
              placeholder="Optional display name"
              maxLength={MAX_NAME_LENGTH}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
              placeholder="What does this source contain?"
              rows={2}
              maxLength={MAX_DESCRIPTION_LENGTH}
            />
          </div>

          {/* Type-specific fields */}
          {(type === 'website' || type === 'docs_portal') && (
            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">URL</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                type="url"
              />
            </div>
          )}

          {type === 'raw_text' && (
            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">Content</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste raw text..."
                rows={10}
              />
            </div>
          )}

          {error && <p className="text-sm text-[color:var(--accent-danger)]">{error}</p>}
        </div>

        <div className="shrink-0 border-t-2 border-[color:var(--border-subtle)] p-4">
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={!canSave || isSaving}>
              {isSaving ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}

// ============================================================================
// Inline-editable text field (mirrors product-scope-sidebar's EditableTextField)
// ============================================================================

function EditableTextField({
  value,
  onSave,
  placeholder,
  type = 'text',
  maxLength,
  label,
}: {
  value: string | null | undefined
  onSave: (newValue: string) => Promise<boolean>
  placeholder?: string
  type?: 'text' | 'textarea'
  maxLength?: number
  label?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isEditing) setEditValue(value ?? '')
  }, [value, isEditing])

  const handleStartEdit = () => {
    setEditValue(value ?? '')
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(value ?? '')
    setIsEditing(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onSave(editValue)
    setIsSaving(false)
    if (success) setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea' && !e.shiftKey) void handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">{label}</span>
        )}
        <div className="flex items-start gap-1">
          {type === 'textarea' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(maxLength ? e.target.value.substring(0, maxLength) : e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={4}
              maxLength={maxLength}
              placeholder={placeholder}
              className="flex-1 rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(maxLength ? e.target.value.substring(0, maxLength) : e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              maxLength={maxLength}
              placeholder={placeholder}
              className="flex-1 rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
            />
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-[4px] p-1 text-[color:var(--accent-success)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
            aria-label="Save"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-[4px] p-1 text-[color:var(--accent-danger)] transition hover:bg-[color:var(--surface-hover)]"
            aria-label="Cancel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex flex-col gap-1">
      {label && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">{label}</span>
          <button
            type="button"
            onClick={handleStartEdit}
            className="rounded-[4px] p-1 text-[color:var(--text-secondary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] group-hover:opacity-100"
            aria-label="Edit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
        </div>
      )}
      <div className="flex items-start gap-1">
        <p className={`flex-1 whitespace-pre-wrap text-sm ${value ? 'text-[color:var(--foreground)]' : 'text-[color:var(--text-tertiary)]'}`}>
          {value || placeholder || '-'}
        </p>
        {!label && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="rounded-[4px] p-1 text-[color:var(--text-secondary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] group-hover:opacity-100"
            aria-label="Edit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
        )}
      </div>
    </div>
  )
}

function EditableName({
  value,
  onSave,
}: {
  value: string | null
  onSave: (newValue: string) => Promise<boolean>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')

  useEffect(() => {
    if (!isEditing) setEditValue(value ?? '')
  }, [value, isEditing])

  const handleSave = async () => {
    const trimmed = editValue.trim()
    if (!trimmed) {
      setEditValue(value ?? '')
      setIsEditing(false)
      return
    }
    const ok = await onSave(trimmed)
    if (ok) setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="mt-1 flex items-center gap-1">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.substring(0, MAX_NAME_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave()
            if (e.key === 'Escape') {
              setEditValue(value ?? '')
              setIsEditing(false)
            }
          }}
          onBlur={() => void handleSave()}
          autoFocus
          maxLength={MAX_NAME_LENGTH}
          className="w-full rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-2 py-1 text-lg font-semibold text-[color:var(--foreground)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
          placeholder="Source name..."
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group mt-1 flex w-full items-center gap-2 text-left"
    >
      <span className={`text-lg font-semibold ${value ? 'text-[color:var(--foreground)]' : 'text-[color:var(--text-tertiary)]'}`}>
        {value || 'Untitled source'}
      </span>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[color:var(--text-tertiary)] opacity-0 transition group-hover:opacity-100">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  )
}
