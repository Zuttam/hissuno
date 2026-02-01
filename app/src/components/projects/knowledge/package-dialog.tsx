'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  Button,
  Input,
  Textarea,
  FormField,
  Checkbox,
  Alert,
  Spinner,
  Badge,
  Heading,
} from '@/components/ui'
import type { NamedPackageWithSources, KnowledgeSourceRecord } from '@/lib/knowledge/types'

interface PackageDialogProps {
  projectId: string
  package?: NamedPackageWithSources
  open: boolean
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

export function PackageDialog({
  projectId,
  package: pkg,
  open,
  onClose,
  onSaved,
  onDeleted,
}: PackageDialogProps) {
  const isEditing = !!pkg

  // Form state
  const [name, setName] = useState(pkg?.name ?? '')
  const [description, setDescription] = useState(pkg?.description ?? '')
  const [guidelines, setGuidelines] = useState(pkg?.guidelines ?? '')
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(
    new Set(pkg?.sources?.map((s) => s.id) ?? [])
  )

  // Available sources
  const [availableSources, setAvailableSources] = useState<KnowledgeSourceRecord[]>([])
  const [isLoadingSources, setIsLoadingSources] = useState(true)

  // Save/Delete state
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Fetch available sources
  const fetchSources = useCallback(async () => {
    setIsLoadingSources(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/knowledge-sources`)
      if (!response.ok) throw new Error('Failed to load sources')
      const data = await response.json()
      setAvailableSources(data.sources ?? [])
    } catch (err) {
      console.error('[package-dialog] Failed to fetch sources:', err)
    } finally {
      setIsLoadingSources(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) {
      void fetchSources()
    }
  }, [open, fetchSources])

  // Reset form when package changes
  useEffect(() => {
    if (pkg) {
      setName(pkg.name)
      setDescription(pkg.description ?? '')
      setGuidelines(pkg.guidelines ?? '')
      setSelectedSourceIds(new Set(pkg.sources?.map((s) => s.id) ?? []))
    } else {
      setName('')
      setDescription('')
      setGuidelines('')
      setSelectedSourceIds(new Set())
    }
    setError(null)
    setShowDeleteConfirm(false)
  }, [pkg])

  const handleSourceToggle = (sourceId: string, checked: boolean) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(sourceId)
      } else {
        next.delete(sourceId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Package name is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        guidelines: guidelines.trim() || null,
        sourceIds: Array.from(selectedSourceIds),
      }

      const url = isEditing
        ? `/api/projects/${projectId}/knowledge/packages/${pkg.id}`
        : `/api/projects/${projectId}/knowledge/packages`

      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to save package')
      }

      onSaved?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pkg) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/packages/${pkg.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to delete package')
      }

      onDeleted?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const getSourceLabel = (source: KnowledgeSourceRecord) => {
    if (source.type === 'codebase') {
      return source.analysis_scope ? `Codebase (${source.analysis_scope})` : 'Codebase'
    }
    if (source.url) {
      return source.url
    }
    if (source.type === 'raw_text') {
      return source.content?.slice(0, 50) + '...'
    }
    return source.storage_path ?? 'Unknown source'
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Package Settings' : 'Create Package'}
      size="xl"
    >
      <div className="space-y-4">
        {error && <Alert variant="warning">{error}</Alert>}

        {/* Form Fields */}
        <FormField label="Name" description="A unique name for this knowledge package">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Technical Docs, Customer FAQ"
          />
        </FormField>

        <FormField label="Description" description="Optional description of this package's purpose">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this package contains..."
            rows={2}
          />
        </FormField>

        <FormField label="Guidelines" description="Optional custom analysis guidelines for the AI">
          <Textarea
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder="Any special instructions for analyzing these sources..."
            rows={2}
          />
        </FormField>

        {/* Source Selection */}
        <FormField as="div" label="Sources" description="Select which sources to include">
          {isLoadingSources ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : availableSources.length === 0 ? (
            <p className="text-sm text-[color:var(--text-secondary)]">
              No sources available. Add sources in the Knowledge settings first.
            </p>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto rounded-[4px] border-2 border-[color:var(--border-subtle)] p-3">
              {availableSources.map((source) => (
                <Checkbox
                  key={source.id}
                  checked={selectedSourceIds.has(source.id)}
                  onChange={(checked) => handleSourceToggle(source.id, checked)}
                  label={
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs">
                        {source.type === 'codebase' ? 'Codebase' : source.type}
                      </Badge>
                      <span className="text-sm truncate max-w-[300px]">{getSourceLabel(source)}</span>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </FormField>

        {/* Actions */}
        <div className="flex items-center justify-end pt-4">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={isSaving}
              disabled={isSaving || !name.trim()}
            >
              {isEditing ? 'Save Changes' : 'Create Package'}
            </Button>
          </div>
        </div>

        {/* Danger Zone - Only for editing */}
        {isEditing && !showDeleteConfirm && (
          <div className="mt-6 pt-4 border-t-2 border-[color:var(--border-subtle)]">
            <Heading as="h4" size="subsection" className="text-[color:var(--accent-danger)] mb-3">
              Danger Zone
            </Heading>
            <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)]/30 bg-[color:var(--accent-danger)]/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    Delete this package
                  </p>
                  <p className="text-xs text-[color:var(--text-secondary)] mt-0.5">
                    Permanently delete this package and all generated content.
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <Alert variant="warning">
            <div className="space-y-2">
              <p>
                Are you sure you want to delete this package? This will also delete all generated
                knowledge content. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  loading={isDeleting}
                  disabled={isDeleting}
                >
                  Delete Package
                </Button>
              </div>
            </div>
          </Alert>
        )}
      </div>
    </Dialog>
  )
}
