'use client'

import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { Card, Button, Badge, Alert, Spinner, Collapsible, FormField, Input, Textarea } from '@/components/ui'
import { KnowledgeViewer } from './knowledge-viewer'
import {
  getSourceTypeLabel,
  type KnowledgeSourceRecord,
  type KnowledgeSourceType,
  type KnowledgeCategory,
} from '@/lib/knowledge/types'

interface KnowledgeManagementCardProps {
  projectId: string
  hasCodebase?: boolean
}

interface AnalysisStatus {
  status: 'idle' | 'processing' | 'completed' | 'failed' | 'partial'
  sources: {
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
  }
  failedSources: Array<{ id: string; type: string; error: string | null }>
}

interface KnowledgePackage {
  id: string
  category: KnowledgeCategory
  storage_path: string
  version: number
  generated_at: string
}

type AddSourceType = 'website' | 'docs_portal' | 'raw_text'

export function KnowledgeManagementCard({ projectId, hasCodebase = false }: KnowledgeManagementCardProps) {
  const [sources, setSources] = useState<KnowledgeSourceRecord[]>([])
  const [packages, setPackages] = useState<KnowledgePackage[]>([])
  const [hasKnowledge, setHasKnowledge] = useState(false)
  const [isLoadingSources, setIsLoadingSources] = useState(true)
  const [isLoadingPackages, setIsLoadingPackages] = useState(true)
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add source form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addSourceType, setAddSourceType] = useState<AddSourceType>('website')
  const [addSourceUrl, setAddSourceUrl] = useState('')
  const [addSourceContent, setAddSourceContent] = useState('')
  const [isAddingSource, setIsAddingSource] = useState(false)

  // Fetch knowledge sources
  const fetchSources = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge-sources`)
      if (!response.ok) throw new Error('Failed to load sources')
      const data = await response.json()
      setSources(data.sources ?? [])
    } catch (err) {
      console.error('[knowledge] Failed to fetch sources:', err)
    } finally {
      setIsLoadingSources(false)
    }
  }, [projectId])

  // Fetch knowledge packages
  const fetchPackages = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge`)
      if (!response.ok) throw new Error('Failed to load knowledge')
      const data = await response.json()
      setPackages(data.packages ?? [])
      setHasKnowledge(data.hasKnowledge ?? false)
    } catch (err) {
      console.error('[knowledge] Failed to fetch packages:', err)
    } finally {
      setIsLoadingPackages(false)
    }
  }, [projectId])

  // Fetch analysis status
  const fetchAnalysisStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/analyze`)
      if (!response.ok) throw new Error('Failed to load status')
      const data = await response.json()
      setAnalysisStatus(data)
      return data.status
    } catch (err) {
      console.error('[knowledge] Failed to fetch status:', err)
      return null
    }
  }, [projectId])

  useEffect(() => {
    void fetchSources()
    void fetchPackages()
    void fetchAnalysisStatus()
  }, [fetchSources, fetchPackages, fetchAnalysisStatus])

  // Poll for status while analyzing
  useEffect(() => {
    if (!isAnalyzing) return

    const interval = setInterval(async () => {
      const status = await fetchAnalysisStatus()
      if (status && status !== 'processing') {
        setIsAnalyzing(false)
        void fetchPackages()
        void fetchSources()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isAnalyzing, fetchAnalysisStatus, fetchPackages, fetchSources])

  const handleRunAnalysis = async () => {
    setError(null)
    setIsAnalyzing(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/analyze`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to start analysis')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start analysis'
      setError(message)
      setIsAnalyzing(false)
    }
  }

  const handleAddSource = async () => {
    if (isAddingSource) return

    setIsAddingSource(true)
    setError(null)

    try {
      const body: Record<string, string> = { type: addSourceType }
      if (addSourceType === 'website' || addSourceType === 'docs_portal') {
        if (!addSourceUrl.trim()) {
          throw new Error('URL is required')
        }
        body.url = addSourceUrl.trim()
      } else if (addSourceType === 'raw_text') {
        if (!addSourceContent.trim()) {
          throw new Error('Content is required')
        }
        body.content = addSourceContent.trim()
      }

      const response = await fetch(`/api/projects/${projectId}/knowledge-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to add source')
      }

      // Reset form and refresh
      setAddSourceUrl('')
      setAddSourceContent('')
      setShowAddForm(false)
      void fetchSources()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add source'
      setError(message)
    } finally {
      setIsAddingSource(false)
    }
  }

  const handleDeleteSource = async (sourceId: string) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/knowledge-sources?sourceId=${sourceId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to delete source')
      }

      void fetchSources()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete source'
      setError(message)
    }
  }

  const isLoading = isLoadingSources || isLoadingPackages

  // Calculate total sources count (including codebase if present)
  const totalSourcesCount = sources.length + (hasCodebase ? 1 : 0)

  return (
    <Card>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-mono text-xl font-bold uppercase tracking-tight text-[color:var(--foreground)]">
              Knowledge Base
            </h2>
            <p className="text-sm text-[color:var(--text-secondary)] mt-1">
              Manage knowledge sources and compiled documentation for the support agent.
            </p>
          </div>
          <Button
            onClick={handleRunAnalysis}
            loading={isAnalyzing}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : hasKnowledge ? 'Re-run Analysis' : 'Run Analysis'}
          </Button>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="warning" className="mb-4">
            {error}
          </Alert>
        )}

        {analysisStatus && analysisStatus.status === 'processing' && (
          <Alert variant="info" className="mb-4">
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <span>Analysis in progress...</span>
            </div>
          </Alert>
        )}

        {analysisStatus && analysisStatus.status === 'failed' && (
          <Alert variant="warning" className="mb-4">
            Some sources failed to analyze. Check the sources below for details.
          </Alert>
        )}

        {/* Primary: Knowledge Section */}
        <KnowledgeSection
          packages={packages}
          isLoading={isLoading}
          projectId={projectId}
          onPackageUpdated={fetchPackages}
        />

        {/* Secondary: Collapsible Sources Section */}
        <div className="mt-6 pt-6 border-t border-[color:var(--border-subtle)]">
          <Collapsible
            defaultOpen={false}
            trigger={<span>Sources ({totalSourcesCount})</span>}
            headerActions={
              !showAddForm && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="text-sm text-[color:var(--accent-selected)] hover:underline transition"
                >
                  + Add source
                </button>
              )
            }
          >
            <SourcesSection
              sources={sources}
              hasCodebase={hasCodebase}
              isLoading={isLoading}
              showAddForm={showAddForm}
              onShowAddForm={() => setShowAddForm(true)}
              onHideAddForm={() => setShowAddForm(false)}
              addSourceType={addSourceType}
              onAddSourceTypeChange={setAddSourceType}
              addSourceUrl={addSourceUrl}
              onAddSourceUrlChange={setAddSourceUrl}
              addSourceContent={addSourceContent}
              onAddSourceContentChange={setAddSourceContent}
              isAddingSource={isAddingSource}
              onAddSource={handleAddSource}
              onDeleteSource={handleDeleteSource}
            />
          </Collapsible>
        </div>
      </div>
    </Card>
  )
}

// ============================================================================
// Knowledge Section (Primary)
// ============================================================================

interface KnowledgeSectionProps {
  packages: KnowledgePackage[]
  isLoading: boolean
  projectId: string
  onPackageUpdated?: () => void
}

function KnowledgeSection({ packages, isLoading, projectId, onPackageUpdated }: KnowledgeSectionProps) {
  const [activeCategory, setActiveCategory] = useState<KnowledgeCategory>('product')
  const [content, setContent] = useState<string | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchContent = useCallback(
    async (category: KnowledgeCategory) => {
      setIsLoadingContent(true)
      try {
        const response = await fetch(
          `/api/projects/${projectId}/knowledge?category=${category}&includeContent=true`
        )
        if (!response.ok) throw new Error('Failed to load content')
        const data = await response.json()
        const pkg = data.packages?.[0]
        setContent(pkg?.content ?? null)
      } catch (err) {
        console.error('[knowledge] Failed to fetch content:', err)
        setContent(null)
      } finally {
        setIsLoadingContent(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    if (packages.length > 0) {
      void fetchContent(activeCategory)
    }
  }, [activeCategory, packages.length, fetchContent])

  const handleSave = async (newContent: string) => {
    setIsSaving(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: activeCategory,
          content: newContent,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to save changes')
      }

      // Update local content and exit edit mode
      setContent(newContent)
      setIsEditing(false)
      
      // Notify parent to refresh packages (to get updated version number)
      onPackageUpdated?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save changes'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setSaveError(null)
  }

  const handleEdit = () => {
    setIsEditing(true)
    setSaveError(null)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (packages.length === 0) {
    return (
      <div className="rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] p-8 text-center">
        <p className="text-sm text-[color:var(--text-secondary)]">
          No knowledge packages generated yet. Run analysis to create knowledge documentation.
        </p>
      </div>
    )
  }

  const categories: KnowledgeCategory[] = ['business', 'product', 'technical']
  const activePackage = packages.find((p) => p.category === activeCategory)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {categories.map((category) => {
            const pkg = packages.find((p) => p.category === category)
            return (
              <button
                key={category}
                type="button"
                onClick={() => {
                  if (!isEditing) {
                    setActiveCategory(category)
                  }
                }}
                disabled={!pkg || isEditing}
                className={`rounded-[4px] border-2 px-4 py-2 font-mono text-sm font-semibold uppercase transition
                  ${
                    activeCategory === category
                      ? 'border-[color:var(--accent-selected)] bg-[color:var(--accent-selected)]/10 text-[color:var(--accent-selected)]'
                      : pkg && !isEditing
                        ? 'border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:border-[color:var(--border)]'
                        : 'border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)] opacity-50 cursor-not-allowed'
                  }`}
              >
                {category}
                {pkg && <span className="ml-1 text-xs opacity-60">v{pkg.version}</span>}
              </button>
            )
          })}
        </div>

        {/* Edit button - only show when content exists and not already editing */}
        {activePackage && content && !isEditing && (
          <button
            type="button"
            onClick={handleEdit}
            className="text-sm text-[color:var(--accent-selected)] hover:underline transition font-mono"
          >
            Edit
          </button>
        )}
      </div>

      {saveError && (
        <Alert variant="warning">
          {saveError}
        </Alert>
      )}

      <div className={`rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4 ${isEditing ? '' : 'max-h-[600px] overflow-y-auto'}`}>
        {isLoadingContent ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : content ? (
          <KnowledgeViewer
            content={content}
            isEditing={isEditing}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <p className="text-sm text-[color:var(--text-secondary)]">No content available.</p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Sources Section (Collapsible)
// ============================================================================

interface SourcesSectionProps {
  sources: KnowledgeSourceRecord[]
  hasCodebase: boolean
  isLoading: boolean
  showAddForm: boolean
  onShowAddForm: () => void
  onHideAddForm: () => void
  addSourceType: AddSourceType
  onAddSourceTypeChange: (type: AddSourceType) => void
  addSourceUrl: string
  onAddSourceUrlChange: (url: string) => void
  addSourceContent: string
  onAddSourceContentChange: (content: string) => void
  isAddingSource: boolean
  onAddSource: () => void
  onDeleteSource: (id: string) => void
}

function SourcesSection({
  sources,
  hasCodebase,
  isLoading,
  showAddForm,
  onHideAddForm,
  addSourceType,
  onAddSourceTypeChange,
  addSourceUrl,
  onAddSourceUrlChange,
  addSourceContent,
  onAddSourceContentChange,
  isAddingSource,
  onAddSource,
  onDeleteSource,
}: SourcesSectionProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Add Source Form */}
      {showAddForm && (
        <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--foreground)] mb-4">
            Add Knowledge Source
          </h3>

          <div className="space-y-4">
            <div className="flex gap-2">
              {(['website', 'docs_portal', 'raw_text'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAddSourceTypeChange(type)}
                  className={`rounded-[4px] border-2 px-3 py-2 font-mono text-xs font-semibold uppercase transition
                    ${
                      addSourceType === type
                        ? 'border-[color:var(--accent-selected)] bg-[color:var(--accent-selected)]/10 text-[color:var(--accent-selected)]'
                        : 'border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:border-[color:var(--border)]'
                    }`}
                >
                  {getSourceTypeLabel(type)}
                </button>
              ))}
            </div>

            {(addSourceType === 'website' || addSourceType === 'docs_portal') && (
              <FormField
                label={addSourceType === 'website' ? 'Website URL' : 'Documentation URL'}
                htmlFor="add-url"
              >
                <Input
                  id="add-url"
                  type="url"
                  value={addSourceUrl}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => onAddSourceUrlChange(e.target.value)}
                  placeholder={
                    addSourceType === 'website'
                      ? 'https://yourcompany.com'
                      : 'https://docs.yourcompany.com'
                  }
                />
              </FormField>
            )}

            {addSourceType === 'raw_text' && (
              <FormField label="Content" htmlFor="add-content">
                <Textarea
                  id="add-content"
                  value={addSourceContent}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onAddSourceContentChange(e.target.value)}
                  placeholder="Add Q&A pairs, notes, or any knowledge..."
                  rows={4}
                />
              </FormField>
            )}

            <div className="flex gap-2">
              <Button onClick={onAddSource} loading={isAddingSource}>
                Add Source
              </Button>
              <Button variant="ghost" onClick={onHideAddForm}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sources List */}
      <div className="space-y-2">
        {/* Codebase - Mandatory first source */}
        {hasCodebase && <CodebaseSourceItem />}

        {/* Other sources */}
        {sources.map((source) => (
          <SourceItem key={source.id} source={source} onDelete={() => onDeleteSource(source.id)} />
        ))}

        {/* Empty state when no additional sources */}
        {!hasCodebase && sources.length === 0 && (
          <div className="rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] p-6 text-center">
            <p className="text-sm text-[color:var(--text-secondary)]">
              No knowledge sources configured. Add sources like your website, documentation, or custom notes.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Source Items
// ============================================================================

function CodebaseSourceItem() {
  return (
    <div className="flex items-center justify-between rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant="default">Codebase</Badge>
        <span className="text-sm text-[color:var(--foreground)]">Project source code</span>
        <Badge variant="success">active</Badge>
      </div>
      <div className="flex items-center gap-2 text-[color:var(--text-tertiary)]">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="text-xs">Required</span>
      </div>
    </div>
  )
}

interface SourceItemProps {
  source: KnowledgeSourceRecord
  onDelete: () => void
}

function SourceItem({ source, onDelete }: SourceItemProps) {
  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
    pending: 'default',
    processing: 'info',
    completed: 'success',
    failed: 'warning',
  }

  const displayValue =
    source.url ||
    (source.type === 'raw_text' ? source.content?.slice(0, 80) + '...' : source.storage_path) ||
    'Unknown'

  return (
    <div className="flex items-center justify-between rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant="default">{getSourceTypeLabel(source.type as KnowledgeSourceType)}</Badge>
        <span className="text-sm text-[color:var(--foreground)] truncate max-w-[300px]">{displayValue}</span>
        <Badge variant={statusColors[source.status] ?? 'default'}>{source.status}</Badge>
      </div>
      <div className="flex items-center gap-2">
        {source.error_message && (
          <span className="text-xs text-[color:var(--accent-danger)]" title={source.error_message}>
            Error
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  )
}
