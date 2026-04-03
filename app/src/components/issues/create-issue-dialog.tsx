'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Dialog, Button, Select, Input, Textarea } from '@/components/ui'
import { Combobox, type ComboboxItem } from '@/components/ui/combobox'
import { SessionPicker } from '@/components/sessions/session-picker'
import { searchEntities } from '@/components/shared/related-entities-section'
import { linkEntities } from '@/lib/api/relationships'
import type { CreateIssueInput, IssueType, IssuePriority, IssueWithProject } from '@/types/issue'
import type { EntityType } from '@/lib/db/queries/types'
import { useProductScopes } from '@/hooks/use-product-scopes'

interface PickedEntity {
  id: string
  label: string
}

interface CreateIssueDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  projectName: string
  onCreateIssue: (input: CreateIssueInput) => Promise<IssueWithProject | null>
}

export function CreateIssueDialog({
  open,
  onClose,
  projectId,
  projectName,
  onCreateIssue,
}: CreateIssueDialogProps) {
  const [type, setType] = useState<IssueType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<IssuePriority>('low')
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [productScopeId, setProductScopeId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Entity pickers state
  const [companies, setCompanies] = useState<PickedEntity[]>([])
  const [contacts, setContacts] = useState<PickedEntity[]>([])
  const [knowledgeSources, setKnowledgeSources] = useState<PickedEntity[]>([])

  const { scopes: productScopes } = useProductScopes({ projectId })

  const resetForm = useCallback(() => {
    setType('bug')
    setTitle('')
    setDescription('')
    setPriority('low')
    setProductScopeId(null)
    setSelectedSessionIds([])
    setCompanies([])
    setContacts([])
    setKnowledgeSources([])
    setError(null)
    setIsSubmitting(false)
  }, [])

  useEffect(() => {
    if (open) resetForm()
  }, [open, resetForm])

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
        // Phase 1: Create the issue
        const input: CreateIssueInput = {
          project_id: projectId,
          session_ids: selectedSessionIds.length > 0 ? selectedSessionIds : undefined,
          type,
          name: title.trim(),
          description: description.trim(),
          priority,
          product_scope_id: productScopeId,
        }

        const result = await onCreateIssue(input)
        if (!result) {
          setError('Failed to create issue. Please try again.')
          return
        }

        // Phase 2: Link selected entities
        const linkOps: Promise<Response>[] = []
        for (const c of companies) {
          linkOps.push(linkEntities(projectId, 'issue', result.id, 'company', c.id))
        }
        for (const c of contacts) {
          linkOps.push(linkEntities(projectId, 'issue', result.id, 'contact', c.id))
        }
        for (const k of knowledgeSources) {
          linkOps.push(linkEntities(projectId, 'issue', result.id, 'knowledge_source', k.id))
        }

        if (linkOps.length > 0) {
          await Promise.allSettled(linkOps)
        }

        // Reset form and close dialog
        resetForm()
        onClose()
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
      productScopeId,
      selectedSessionIds,
      companies,
      contacts,
      knowledgeSources,
      onCreateIssue,
      resetForm,
      onClose,
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
              Project
            </label>
            <div className="flex h-9 items-center rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--foreground)]">
              {projectName}
            </div>
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

        <div className="grid grid-cols-2 gap-4">
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

          {productScopes.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[color:var(--text-secondary)]">
                Scope
              </label>
              <Select
                value={productScopeId ?? ''}
                onChange={(e) => setProductScopeId(e.target.value || null)}
              >
                <option value="">Default</option>
                {productScopes.filter((a) => !a.is_default).map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {scope.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
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

        {/* Entity Linking */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]">
            Link entities
          </label>
          <MultiEntityPicker
            label="Companies"
            projectId={projectId}
            entityType="company"
            selected={companies}
            onChange={setCompanies}
          />
          <MultiEntityPicker
            label="Contacts"
            projectId={projectId}
            entityType="contact"
            selected={contacts}
            onChange={setContacts}
          />
          <MultiEntityPicker
            label="Knowledge"
            projectId={projectId}
            entityType="knowledge_source"
            selected={knowledgeSources}
            onChange={setKnowledgeSources}
          />
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

// ---------------------------------------------------------------------------
// Multi-entity picker: search + accumulate pattern
// ---------------------------------------------------------------------------

interface MultiEntityPickerProps {
  label: string
  projectId: string
  entityType: EntityType
  selected: PickedEntity[]
  onChange: (items: PickedEntity[]) => void
}

function MultiEntityPicker({ label, projectId, entityType, selected, onChange }: MultiEntityPickerProps) {
  const [value, setValue] = useState<string | undefined>(undefined)
  const lastResultsRef = useRef<ComboboxItem[]>([])

  const selectedIds = selected.map((s) => s.id)
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds

  const searchFn = useCallback(
    async (query: string): Promise<ComboboxItem[]> => {
      try {
        const items = await searchEntities(projectId, entityType, query)
        const filtered = items.filter((i) => !selectedIdsRef.current.includes(i.value))
        lastResultsRef.current = filtered
        return filtered
      } catch {
        return []
      }
    },
    [projectId, entityType],
  )

  const handleSelect = useCallback(
    (val: string | undefined) => {
      if (!val) return
      setValue(undefined)
      const match = lastResultsRef.current.find((i) => i.value === val)
      onChange([...selected, { id: val, label: match?.label ?? val }])
    },
    [selected, onChange],
  )

  const handleRemove = useCallback(
    (id: string) => {
      onChange(selected.filter((s) => s.id !== id))
    },
    [selected, onChange],
  )

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wide text-[color:var(--text-tertiary)]">
        {label}
      </span>
      <Combobox
        items={[]}
        onSearch={searchFn}
        value={value}
        onValueChange={handleSelect}
        placeholder={`Search ${label.toLowerCase()}...`}
        emptyMessage="No results"
        size="sm"
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-[4px] bg-[color:var(--surface-hover)] px-2 py-0.5 text-xs text-[color:var(--foreground)]"
            >
              {item.label}
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
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
