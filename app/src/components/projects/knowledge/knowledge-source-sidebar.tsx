'use client'

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from 'react'
import Image from 'next/image'
import { CollapsibleSection, Button, Dialog, Input, Select, Textarea, Alert } from '@/components/ui'
import { fetchGithubStatus, fetchGithubRepos, fetchGithubBranches, fetchNotionStatus } from '@/lib/api/plugins'
import { NotionPickerDialog } from '@/components/projects/knowledge/notion-picker-dialog'
import type { KnowledgeSourceType, KnowledgeSourceWithCodebase } from '@/lib/knowledge/types'
import { getSourceDisplayValue, getSourceTypeLabel } from '@/lib/knowledge/types'
import type { ProductScopeRecord } from '@/types/product-scope'
import type { AnalysisEvent } from '@/hooks/use-issue-analysis'
import { formatDateTime } from '@/lib/utils/format-time'
import { WorkflowProgress } from '@/components/issues/workflow-progress'
import { RelatedEntitiesSection } from '@/components/shared/related-entities-section'
import { CustomFieldsRenderer } from '@/components/shared/custom-fields-renderer'
import { useCustomFields } from '@/hooks/use-custom-fields'
import { MarkdownContent } from '@/components/ui/markdown-content'

interface KnowledgeSourceSidebarEditProps {
  source: KnowledgeSourceWithCodebase
  onClose: () => void
  onUpdate: (sourceId: string, updates: Record<string, unknown>) => Promise<boolean>
  onDelete: (sourceId: string, options?: { children?: 'reparent' | 'delete' }) => Promise<boolean>
  onAnalyze?: (sourceId: string) => Promise<void>
  isAnalyzing?: boolean
  analysisEvents?: AnalysisEvent[]
  productScopes?: ProductScopeRecord[]
}

interface KnowledgeSourceSidebarCreateProps {
  createType: KnowledgeSourceType
  projectId: string
  onClose: () => void
  onAdd: (data: FormData | Record<string, unknown>) => Promise<KnowledgeSourceWithCodebase | null>
}

export type KnowledgeSourceSidebarProps = KnowledgeSourceSidebarEditProps | KnowledgeSourceSidebarCreateProps

function isCreateMode(props: KnowledgeSourceSidebarProps): props is KnowledgeSourceSidebarCreateProps {
  return 'createType' in props
}

const TYPE_ICONS: Record<KnowledgeSourceType, React.ReactNode> = {
  codebase: <Image src="/logos/github.svg" alt="GitHub" width={16} height={16} />,
  website: <span>🌐</span>,
  docs_portal: <span>📚</span>,
  uploaded_doc: <span>📄</span>,
  raw_text: <span>📝</span>,
  notion: <Image src="/logos/notion.svg" alt="Notion" width={16} height={16} className="dark:invert" />,
  folder: <span>📁</span>,
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  done: { color: 'var(--accent-success)', label: 'Analyzed' },
  analyzing: { color: 'var(--accent-warning)', label: 'Analyzing' },
  failed: { color: 'var(--accent-danger)', label: 'Failed' },
  pending: { color: 'var(--text-tertiary)', label: 'Pending' },
}

export function KnowledgeSourceSidebar(props: KnowledgeSourceSidebarProps) {
  if (isCreateMode(props)) {
    return <CreateModeSidebar {...props} />
  }
  return <EditModeSidebar {...props} />
}

// ============================================================================
// Edit Mode (existing source)
// ============================================================================

function EditModeSidebar({
  source,
  onClose,
  onUpdate,
  onDelete,
  onAnalyze,
  isAnalyzing: isAnalyzingProp = false,
  analysisEvents,
}: KnowledgeSourceSidebarEditProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isAnalyzingLocal, setIsAnalyzingLocal] = useState(false)

  const { fields: customFields } = useCustomFields({
    projectId: source.project_id,
    entityType: 'knowledge_source',
  })

  // Analysis is in progress if either the parent says so (SSE connected) or we're waiting for the POST
  const isAnalyzing = isAnalyzingProp || isAnalyzingLocal

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    const success = await onDelete(source.id)
    setIsDeleting(false)
    if (success) {
      setShowDeleteConfirm(false)
      onClose()
    }
  }, [source.id, onDelete, onClose])

  const handleAnalyze = useCallback(async () => {
    if (!onAnalyze) return
    setIsAnalyzingLocal(true)
    try {
      await onAnalyze(source.id)
    } finally {
      setIsAnalyzingLocal(false)
    }
  }, [source.id, onAnalyze])

  const handleFieldSave = useCallback(async (fieldKey: string, newValue: string): Promise<boolean> => {
    return onUpdate(source.id, { [fieldKey]: newValue || null })
  }, [source.id, onUpdate])

  const handleCustomFieldChange = useCallback((key: string, value: unknown) => {
    const currentFields = (source.custom_fields as Record<string, unknown>) ?? {}
    void onUpdate(source.id, { custom_fields: { ...currentFields, [key]: value } })
  }, [source.id, source.custom_fields, onUpdate])

  const statusConfig = STATUS_CONFIG[source.status] ?? STATUS_CONFIG.pending
  const displayValue = getSourceDisplayValue(source)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        {/* Header */}
        <div className="shrink-0 border-b-2 border-[color:var(--border-subtle)] p-4">
          {/* Row 1: Type label + close */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              {TYPE_ICONS[source.type]}
              {getSourceTypeLabel(source.type)}
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
          {/* Row 2: Title (inline editable) */}
          <EditableHeaderName
            name={source.name}
            displayFallback={displayValue}
            onSave={(newName) => handleFieldSave('name', newName)}
          />
          {/* Row 2b: Description (inline editable) */}
          <EditableHeaderDescription
            description={source.description}
            onSave={(desc) => handleFieldSave('description', desc)}
          />
          {/* Row 3: Action buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {/* Build / Re-analyze (not for folders) */}
            {onAnalyze && source.type !== 'folder' && (
              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={isAnalyzing || source.status === 'analyzing'}
                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs transition hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${
                  source.status === 'done'
                    ? 'text-[color:var(--accent-success)]'
                    : 'text-[color:var(--text-secondary)]'
                }`}
              >
                {source.status === 'done' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                )}
                <span>
                  {isAnalyzing || source.status === 'analyzing'
                    ? 'Analyzing...'
                    : source.status === 'done' || source.status === 'failed'
                      ? 'Re-analyze'
                      : 'Analyze'}
                </span>
              </button>
            )}
            {/* Delete */}
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
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Analysis Progress */}
          {isAnalyzing && analysisEvents && (
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <WorkflowProgress
                events={analysisEvents}
                isProcessing={isAnalyzing}
              />
            </div>
          )}

          {/* Details section */}
          <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
            <CollapsibleSection title="Details" variant="flat" defaultExpanded>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Custom fields */}
                {customFields.length > 0 && (
                  <div className="col-span-2">
                    <CustomFieldsRenderer
                      fields={customFields}
                      values={(source.custom_fields as Record<string, unknown>) ?? {}}
                      onChange={handleCustomFieldChange}
                    />
                  </div>
                )}

                {/* Type-specific field */}
                <div className="col-span-2">
                  <TypeSpecificField source={source} />
                </div>

                {/* Analysis scope (codebase only) */}
                {source.type === 'codebase' && (
                  <div className="col-span-2">
                    <EditableDetailField
                      label="Analysis Scope"
                      value={source.analysis_scope}
                      fieldKey="analysis_scope"
                      onSave={handleFieldSave}
                      placeholder="e.g., packages/core"
                    />
                  </div>
                )}

                {/* Read-only fields */}
                <DetailField label="Status">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: statusConfig.color }}
                    />
                    {statusConfig.label}
                  </span>
                </DetailField>
                {source.error_message && (
                  <div className="col-span-2">
                    <DetailField label="Error">
                      <span className="text-[color:var(--accent-danger)]">{source.error_message}</span>
                    </DetailField>
                  </div>
                )}
                <DetailField label="Last Analyzed">
                  {source.analyzed_at ? formatDateTime(source.analyzed_at) : 'Never'}
                </DetailField>
                <DetailField label="Created">
                  {formatDateTime(source.created_at)}
                </DetailField>
              </div>
            </CollapsibleSection>
          </div>

          {/* Related entities */}
          <RelatedEntitiesSection
            projectId={source.project_id}
            entityType="knowledge_source"
            entityId={source.id}
            allowedTypes={['company', 'contact', 'issue', 'session', 'product_scope']}
          />
        </div>

      </aside>

      {/* Delete confirmation */}
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title={source.type === 'folder' ? 'Delete Folder' : 'Delete Source'} size="md">
        <p className="text-sm text-[color:var(--text-secondary)]">
          {source.type === 'folder'
            ? 'What should happen to the items inside this folder?'
            : 'Are you sure you want to delete this knowledge source? This action cannot be undone.'}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          {source.type === 'folder' ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => void handleDelete()} loading={isDeleting}>
                Move items out & delete folder
              </Button>
              <Button variant="danger" size="sm" onClick={async () => {
                setIsDeleting(true)
                const success = await onDelete(source.id, { children: 'delete' })
                setIsDeleting(false)
                if (success) { setShowDeleteConfirm(false); onClose() }
              }} loading={isDeleting}>
                Delete everything
              </Button>
            </>
          ) : (
            <Button variant="danger" size="sm" onClick={() => void handleDelete()} loading={isDeleting}>Delete</Button>
          )}
        </div>
      </Dialog>
    </>
  )
}

// ============================================================================
// Create Mode (new source)
// ============================================================================

interface Repo {
  id: number
  fullName: string
  defaultBranch: string
}

function CreateModeSidebar({
  createType,
  projectId,
  onClose,
  onAdd,
}: KnowledgeSourceSidebarCreateProps) {
  // Shared fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({})

  const { fields: customFields } = useCustomFields({
    projectId,
    entityType: 'knowledge_source',
  })

  const handleCustomFieldChange = useCallback((key: string, value: unknown) => {
    setCustomFieldValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  // URL input (website, docs_portal)
  const [url, setUrl] = useState('')

  // Raw text input
  const [content, setContent] = useState('')

  // Document origin (for uploaded_doc type)
  const [docOrigin, setDocOrigin] = useState<'upload' | 'notion'>('upload')
  const [notionConnected, setNotionConnected] = useState(false)
  const [showNotionPicker, setShowNotionPicker] = useState(false)
  const [selectedNotionPage, setSelectedNotionPage] = useState<{ pageId: string; title: string; url: string } | null>(null)

  // File upload
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Codebase / GitHub state
  const [githubConnected, setGithubConnected] = useState(false)
  const [repos, setRepos] = useState<Repo[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [analysisScope, setAnalysisScope] = useState('')
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)

  // Fetch Notion status for uploaded_doc type
  useEffect(() => {
    if (createType !== 'uploaded_doc') return
    const checkNotion = async () => {
      try {
        const res = await fetchNotionStatus(projectId)
        if (res.ok) {
          const data = await res.json()
          setNotionConnected(data.connected)
        }
      } catch {
        // Silent
      }
    }
    void checkNotion()
  }, [createType, projectId])

  // Fetch GitHub status + repos for codebase type
  useEffect(() => {
    if (createType !== 'codebase') return

    const fetchGitHub = async () => {
      try {
        const res = await fetchGithubStatus(projectId)
        if (res.ok) {
          const data = await res.json()
          setGithubConnected(data.connected)

          if (data.connected) {
            setIsLoadingRepos(true)
            try {
              const reposData = await fetchGithubRepos(projectId)
              setRepos(reposData.repos ?? [])
            } catch {
              // Silent
            }
            setIsLoadingRepos(false)
          }
        }
      } catch {
        // Silent
      }
    }

    void fetchGitHub()
  }, [createType, projectId])

  // Fetch branches when repo changes
  useEffect(() => {
    if (!selectedRepo) return

    const fetchBranches = async () => {
      setIsLoadingBranches(true)
      try {
        const [owner, repo] = selectedRepo.split('/')
        const data = await fetchGithubBranches(projectId, owner, repo)
        setBranches(data.branches?.map((b) => b.name) ?? [])
      } catch {
        // Silent
      } finally {
        setIsLoadingBranches(false)
      }
    }

    void fetchBranches()
  }, [selectedRepo, projectId])

  const handleRepoChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const fullName = e.target.value
    setSelectedRepo(fullName)
    const repo = repos.find(r => r.fullName === fullName)
    if (repo) {
      setSelectedBranch(repo.defaultBranch)
    }
  }, [repos])

  const isAddDisabled = () => {
    if (!name.trim() || !description.trim()) return true
    if (createType === 'codebase') return !selectedRepo || !selectedBranch
    if (createType === 'uploaded_doc') {
      if (docOrigin === 'notion') return !selectedNotionPage
      return !file
    }
    if (createType === 'website' || createType === 'docs_portal') return !url.trim()
    if (createType === 'raw_text') return !content.trim()
    return true
  }

  const handleSubmit = useCallback(async () => {
    setIsSaving(true)
    setError(null)

    try {
      let result: KnowledgeSourceWithCodebase | null = null

      const cfPayload = Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined

      if (createType === 'codebase') {
        result = await onAdd({
          type: 'codebase',
          repositoryUrl: `https://github.com/${selectedRepo}`,
          repositoryBranch: selectedBranch,
          analysis_scope: analysisScope || null,
          name: name || null,
          description: description || null,
          custom_fields: cfPayload,
        })
      } else if (createType === 'uploaded_doc' && docOrigin === 'notion' && selectedNotionPage) {
        result = await onAdd({
          type: 'uploaded_doc',
          origin: 'notion',
          notionPageId: selectedNotionPage.pageId,
          name: name || selectedNotionPage.title || null,
          description: description || null,
          custom_fields: cfPayload,
        })
      } else if (createType === 'uploaded_doc' && file) {
        const formData = new FormData()
        formData.append('type', createType)
        formData.append('file', file)
        if (name) formData.append('name', name)
        if (description) formData.append('description', description)
        result = await onAdd(formData)
      } else {
        result = await onAdd({
          type: createType,
          url: createType === 'website' || createType === 'docs_portal' ? url : undefined,
          content: createType === 'raw_text' ? content : undefined,
          name: name || null,
          description: description || null,
          custom_fields: cfPayload,
        })
      }

      if (result) onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setIsSaving(false)
    }
  }, [createType, name, description, url, content, file, selectedRepo, selectedBranch, analysisScope, docOrigin, selectedNotionPage, customFieldValues, onAdd, onClose])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        {/* Header */}
        <div className="shrink-0 border-b-2 border-[color:var(--border-subtle)] p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              {TYPE_ICONS[createType]}
              {getSourceTypeLabel(createType)}
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
          <h3 className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
            New {getSourceTypeLabel(createType)}
          </h3>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {error && <Alert variant="danger">{error}</Alert>}

            {/* Type-specific input */}
            {createType === 'codebase' ? (
              !githubConnected ? (
                <Alert variant="info">
                  Connect GitHub to add your codebase as a knowledge source.
                  <Button
                    variant="primary"
                    size="sm"
                    className="ml-4"
                    onClick={() => {
                      const nextUrl = `/projects/${projectId}/knowledge`
                      window.open(`/api/integrations/github/connect?projectId=${projectId}&nextUrl=${encodeURIComponent(nextUrl)}`, '_blank')
                    }}
                  >
                    Connect GitHub
                  </Button>
                </Alert>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">Repository</label>
                      <Select
                        value={selectedRepo}
                        onChange={handleRepoChange}
                        disabled={isLoadingRepos}
                        className="mt-1"
                      >
                        <option value="">
                          {isLoadingRepos ? 'Loading...' : 'Select repository'}
                        </option>
                        {repos.map(repo => (
                          <option key={repo.id} value={repo.fullName}>
                            {repo.fullName}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">Branch</label>
                      <Select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        disabled={isLoadingBranches || !selectedRepo}
                        className="mt-1"
                      >
                        <option value="">
                          {isLoadingBranches ? 'Loading...' : 'Select branch'}
                        </option>
                        {branches.map(branch => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  {selectedRepo && (
                    <div>
                      <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">Analysis Scope</label>
                      <Input
                        value={analysisScope}
                        onChange={(e) => setAnalysisScope(e.target.value)}
                        placeholder="e.g., packages/core (optional)"
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              )
            ) : createType === 'uploaded_doc' ? (
              <div className="flex flex-col gap-3">
                {/* Source selector */}
                <div>
                  <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">Source</label>
                  <Select
                    value={docOrigin}
                    onChange={(e) => {
                      const val = e.target.value as 'upload' | 'notion'
                      setDocOrigin(val)
                      if (val === 'upload') setSelectedNotionPage(null)
                      if (val === 'notion') setFile(null)
                    }}
                    className="mt-1"
                  >
                    <option value="upload">Manual Upload</option>
                    <option value="notion" disabled={!notionConnected}>
                      {notionConnected ? 'Notion Page' : 'Notion (not connected)'}
                    </option>
                  </Select>
                  {!notionConnected && (
                    <button
                      type="button"
                      onClick={() => window.open(`/projects/${projectId}/integrations`, '_blank')}
                      className="mt-1 text-xs text-[color:var(--accent-primary)] hover:underline"
                    >
                      Connect Notion to import pages
                    </button>
                  )}
                </div>

                {docOrigin === 'upload' ? (
                  <div>
                    <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">File</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.md,.doc,.docx"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    <div
                      className="mt-1 flex items-center gap-3 rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] px-4 py-3 cursor-pointer hover:border-[color:var(--accent-selected)] transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          fileInputRef.current?.click()
                        }}
                      >
                        Choose file
                      </Button>
                      <span className="text-sm text-[color:var(--text-secondary)] truncate">
                        {file ? file.name : 'No file selected'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">Page</label>
                    {selectedNotionPage ? (
                      <div className="mt-1 flex items-center gap-2 rounded-[4px] border border-[color:var(--border-subtle)] px-3 py-2">
                        <Image src="/logos/notion.svg" alt="Notion" width={14} height={14} className="dark:invert" />
                        <span className="flex-1 text-sm text-[color:var(--foreground)] truncate">
                          {selectedNotionPage.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowNotionPicker(true)}
                          className="text-xs text-[color:var(--accent-primary)] hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div
                        className="mt-1 flex items-center gap-3 rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] px-4 py-3 cursor-pointer hover:border-[color:var(--accent-selected)] transition-colors"
                        onClick={() => setShowNotionPicker(true)}
                      >
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowNotionPicker(true)
                          }}
                        >
                          Choose Page
                        </Button>
                        <span className="text-sm text-[color:var(--text-secondary)]">
                          No page selected
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <NotionPickerDialog
                  open={showNotionPicker}
                  onClose={() => setShowNotionPicker(false)}
                  projectId={projectId}
                  mode="single"
                  onPageSelected={(page) => {
                    setSelectedNotionPage(page)
                    if (!name) setName(page.title)
                    if (!description) setDescription(`Imported from Notion: ${page.title}`)
                    setShowNotionPicker(false)
                  }}
                />
              </div>
            ) : createType === 'raw_text' ? (
              <div>
                <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">
                  Content <span className="text-[color:var(--accent-danger)]">*</span>
                </label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter custom knowledge content..."
                  rows={5}
                  className="mt-1"
                />
              </div>
            ) : (
              <div>
                <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">
                  URL <span className="text-[color:var(--accent-danger)]">*</span>
                </label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={createType === 'docs_portal' ? 'https://docs.example.com' : 'https://example.com'}
                  className="mt-1"
                />
              </div>
            )}

            {/* Name */}
            <div>
              <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">
                Name <span className="text-[color:var(--accent-danger)]">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g., "Product docs" or "API reference"`}
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">
                Description <span className="text-[color:var(--accent-danger)]">*</span>
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Help the AI understand what this source contains..."
                rows={2}
                className="mt-1"
              />
            </div>

            {/* Custom fields */}
            {customFields.length > 0 && (
              <CustomFieldsRenderer
                fields={customFields}
                values={customFieldValues}
                onChange={handleCustomFieldChange}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t-2 border-[color:var(--border-subtle)] p-4">
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="md"
              onClick={() => void handleSubmit()}
              disabled={isSaving || isAddDisabled()}
              loading={isSaving}
            >
              Add
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}

// ============================================================================
// DetailField (read-only)
// ============================================================================

function EditableHeaderName({
  name,
  displayFallback,
  onSave,
}: {
  name: string | null | undefined
  displayFallback: string
  onSave: (newName: string) => Promise<boolean>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(name ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleStartEdit = () => {
    setEditValue(name ?? '')
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(name ?? '')
    setIsEditing(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onSave(editValue)
    setIsSaving(false)
    if (success) setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (isEditing) {
    return (
      <div className="mt-1 flex items-center gap-1">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => void handleSave()}
          autoFocus
          disabled={isSaving}
          className="w-full rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-2 py-1 text-lg font-semibold text-[color:var(--foreground)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)] disabled:opacity-50"
          placeholder={displayFallback}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className="group mt-1 flex w-full items-center gap-2 text-left"
    >
      <h3 className="text-lg font-semibold text-[color:var(--foreground)] break-words">
        {name || displayFallback}
      </h3>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[color:var(--text-tertiary)] opacity-0 transition group-hover:opacity-100">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  )
}

function EditableHeaderDescription({
  description,
  onSave,
}: {
  description: string | null | undefined
  onSave: (newValue: string) => Promise<boolean>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(description ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleStartEdit = () => {
    setEditValue(description ?? '')
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(description ?? '')
    setIsEditing(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onSave(editValue)
    setIsSaving(false)
    if (success) setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleCancel()
  }

  if (isEditing) {
    return (
      <div className="mt-1 flex items-start gap-1">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          rows={2}
          className="flex-1 rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
          placeholder="Describe what this source contains..."
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="rounded-[4px] p-1 text-[color:var(--accent-success)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
          aria-label="Save"
        >
          {isSaving ? (
            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          )}
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
    )
  }

  return (
    <div className="group mt-1 flex items-start gap-1">
      <p className={`flex-1 text-sm ${description ? 'text-[color:var(--text-secondary)]' : 'text-[color:var(--text-tertiary)]'}`}>
        {description || 'Add a description...'}
      </p>
      <button
        type="button"
        onClick={handleStartEdit}
        className="rounded-[4px] p-1 text-[color:var(--text-secondary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] group-hover:opacity-100"
        aria-label="Edit description"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
      </button>
    </div>
  )
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">{label}</label>
      <div className="text-[color:var(--foreground)]">{children}</div>
    </div>
  )
}

// ============================================================================
// EditableDetailField
// ============================================================================

function EditableDetailField({
  label,
  value,
  fieldKey,
  onSave,
  type = 'text',
  placeholder,
  required,
}: {
  label: string
  value: string | null | undefined
  fieldKey: string
  onSave: (fieldKey: string, newValue: string) => Promise<boolean>
  type?: 'text' | 'textarea'
  placeholder?: string
  required?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleStartEdit = () => {
    setEditValue(value ?? '')
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(value ?? '')
    setIsEditing(false)
  }

  const isSaveDisabled = isSaving || (required && !editValue.trim())

  const handleSave = async () => {
    if (required && !editValue.trim()) return
    setIsSaving(true)
    const success = await onSave(fieldKey, editValue)
    setIsSaving(false)
    if (success) setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') void handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">{label}{required && <span className="text-[color:var(--accent-danger)] ml-0.5">*</span>}</label>
        <div className="flex items-center gap-1">
          {type === 'textarea' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={3}
              placeholder={placeholder}
              className="flex-1 rounded-md border border-[color:var(--border-subtle)] bg-transparent px-2.5 py-1.5 text-xs text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder={placeholder}
              className="flex-1 rounded-md border border-[color:var(--border-subtle)] bg-transparent px-2.5 py-1.5 text-xs text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
            />
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaveDisabled}
            className="rounded-[4px] p-1 text-[color:var(--accent-success)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
            aria-label="Save"
          >
            {isSaving ? (
              <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            )}
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
      <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">{label}{required && <span className="text-[color:var(--accent-danger)] ml-0.5">*</span>}</label>
      <div className="flex items-center gap-1">
        <p className="flex-1 text-[color:var(--foreground)]">
          {value || <span className="text-[color:var(--text-tertiary)]">{placeholder || '-'}</span>}
        </p>
        <button
          type="button"
          onClick={handleStartEdit}
          className="rounded-[4px] p-1 text-[color:var(--text-secondary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] group-hover:opacity-100"
          aria-label={`Edit ${label}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// ContentPreviewField (markdown preview with expand dialog)
// ============================================================================

function ContentPreviewField({ content, sourceName }: { content: string; sourceName: string | null }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-xs font-medium text-[color:var(--text-secondary)]">Content Preview</label>
      <div className="relative max-h-[300px] overflow-hidden rounded-[4px] border border-[color:var(--border-subtle)] p-2">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute right-1.5 top-1.5 z-10 rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
          aria-label="Expand content"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
        <MarkdownContent content={content} className="text-xs" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--background)] to-transparent" />
      </div>
      <Dialog open={expanded} onClose={() => setExpanded(false)} title={sourceName || 'Content'} size="xxl">
        <MarkdownContent content={content} className="prose-sm" />
      </Dialog>
    </div>
  )
}

// ============================================================================
// TypeSpecificField (read-only display of the source's primary content)
// ============================================================================

function TypeSpecificField({ source }: { source: KnowledgeSourceWithCodebase }) {
  switch (source.type) {
    case 'codebase': {
      if (!source.source_code) return null
      const match = source.source_code.repository_url?.match(/github\.com\/([^/]+\/[^/]+)/)
      const repoName = match ? match[1] : source.source_code.repository_url
      return (
        <DetailField label="Repository">
          <span className="flex items-center gap-2">
            {repoName}
            <span className="text-[color:var(--text-tertiary)]">
              ({source.source_code.repository_branch ?? 'main'})
            </span>
          </span>
        </DetailField>
      )
    }
    case 'website':
    case 'docs_portal':
      return (
        <DetailField label="URL">
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--accent-primary)] hover:underline break-all"
            >
              {source.url}
            </a>
          ) : '-'}
        </DetailField>
      )
    case 'uploaded_doc':
      return (
        <DetailField label="File">
          {source.storage_path?.split('/').pop() ?? '-'}
        </DetailField>
      )
    case 'raw_text':
      return source.content ? (
        <ContentPreviewField content={source.content} sourceName={source.name} />
      ) : (
        <DetailField label="Content Preview">
          <span className="text-[color:var(--text-secondary)]">-</span>
        </DetailField>
      )
    case 'notion':
      return (
        <>
          {source.url && (
            <DetailField label="Notion Page">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[color:var(--accent-primary)] hover:underline break-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open in Notion
              </a>
            </DetailField>
          )}
          {source.analyzed_content && (
            <ContentPreviewField content={source.analyzed_content} sourceName={source.name} />
          )}
        </>
      )
    default:
      return null
  }
}
