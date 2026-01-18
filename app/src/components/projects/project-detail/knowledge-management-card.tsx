'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { Button, Badge, Alert, Spinner, Collapsible } from '@/components/ui'
import { KnowledgeViewer } from './knowledge-viewer'
import { AnalysisProgressBar, type AnalysisEvent } from './analysis-progress-bar'
import {
  getSourceTypeLabel,
  type KnowledgeSourceRecord,
  type KnowledgeSourceType,
  type KnowledgeCategory,
} from '@/lib/knowledge/types'

interface KnowledgeManagementCardProps {
  projectId: string
  onTestAgent?: () => void
}

interface AnalysisStatus {
  status: 'idle' | 'processing' | 'completed' | 'failed' | 'partial' | 'cancelled'
  isRunning?: boolean
  analysisId?: string | null
  runId?: string | null
  startedAt?: string | null
  completedAt?: string | null
  lastAnalysisStatus?: string | null
  lastAnalysisError?: string | null
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

export function KnowledgeManagementCard({ projectId, onTestAgent }: KnowledgeManagementCardProps) {
  const [sources, setSources] = useState<KnowledgeSourceRecord[]>([])
  const [packages, setPackages] = useState<KnowledgePackage[]>([])
  const [hasKnowledge, setHasKnowledge] = useState(false)
  const [isLoadingSources, setIsLoadingSources] = useState(true)
  const [isLoadingPackages, setIsLoadingPackages] = useState(true)
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // SSE stream state
  const [analysisEvents, setAnalysisEvents] = useState<AnalysisEvent[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)


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
      const data = await response.json() as AnalysisStatus
      setAnalysisStatus(data)
      
      // If analysis is already running, set state and add synthetic event for progress bar
      if (data.isRunning) {
        setIsAnalyzing(true)
        // Add a synthetic event if we don't have any events yet
        setAnalysisEvents((prev) => {
          if (prev.length === 0) {
            return [{
              type: 'workflow-start',
              message: 'Knowledge analysis in progress...',
              timestamp: data.startedAt ?? new Date().toISOString(),
            }]
          }
          return prev
        })
      }
      
      return data
    } catch (err) {
      console.error('[knowledge] Failed to fetch status:', err)
      return null
    }
  }, [projectId])

  // Connect to SSE stream for real-time updates
  const connectToStream = useCallback(() => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Clear previous events
    setAnalysisEvents([])

    // Add a synthetic "started" event
    setAnalysisEvents([{
      type: 'workflow-start',
      message: 'Knowledge analysis started',
      timestamp: new Date().toISOString(),
    }])

    try {
      const eventSource = new EventSource(`/api/projects/${projectId}/knowledge/analyze/stream`)
      eventSourceRef.current = eventSource
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as AnalysisEvent
          setAnalysisEvents((prev) => [...prev, data])

          // Check for workflow completion
          if (data.type === 'workflow-finish' || data.type === 'error') {
            eventSource.close()
            eventSourceRef.current = null
            
            // Give a small delay then refresh data
            setTimeout(() => {
              setIsAnalyzing(false)
              void fetchPackages()
              void fetchSources()
              void fetchAnalysisStatus()
            }, 1000)
          }
        } catch (err) {
          console.error('[knowledge] Failed to parse SSE event:', err)
        }
      }

      eventSource.onerror = () => {
        // Only clean up if the connection is actually closed
        // EventSource will automatically reconnect for transient errors
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSourceRef.current = null
        }
      }
    } catch (err) {
      // EventSource creation failed
      console.warn('[knowledge] Failed to create EventSource, falling back to polling', err)
    }
  }, [projectId, fetchPackages, fetchSources, fetchAnalysisStatus])

  // Check for running analysis on mount and connect to stream if needed
  useEffect(() => {
    const init = async () => {
      const status = await fetchAnalysisStatus()
      if (status?.isRunning) {
        connectToStream()
      }
    }
    
    void fetchSources()
    void fetchPackages()
    void init()
    
    // Cleanup SSE connection on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [fetchSources, fetchPackages, fetchAnalysisStatus, connectToStream])

  const handleRunAnalysis = async () => {
    setError(null)
    setIsAnalyzing(true)
    setAnalysisEvents([]) // Clear previous events

    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/analyze`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        // Handle 409 Conflict (already running)
        if (response.status === 409) {
          // Already running - just connect to stream
          connectToStream()
          return
        }
        throw new Error(data.error ?? 'Failed to start analysis')
      }

      // Connect to SSE stream for real-time updates
      connectToStream()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start analysis'
      setError(message)
      setIsAnalyzing(false)
    }
  }

  const handleCancelAnalysis = async () => {
    setError(null)
    
    try {
      const cancelResponse = await fetch(`/api/projects/${projectId}/knowledge/analyze/cancel`, {
        method: 'POST',
      })

      if (!cancelResponse.ok) {
        const data = await cancelResponse.json()
        throw new Error(data.error ?? 'Failed to cancel analysis')
      }

      // Clear events
      setAnalysisEvents([])
      setIsAnalyzing(false)
      
      // Close existing SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      // Refresh status and data
      await fetchAnalysisStatus()
      await fetchSources()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel analysis'
      setError(message)
    }
  }

  const isLoading = isLoadingSources || isLoadingPackages

  // Calculate total sources count (codebase is now included in sources)
  const totalSourcesCount = sources.length

  return (
    <div>
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
        <div className="flex items-center gap-2">
          {hasKnowledge && !isAnalyzing && onTestAgent && (
            <Button onClick={onTestAgent} variant="secondary">
              Test Agent
            </Button>
          )}
          {isAnalyzing && (
            <Button
              onClick={handleCancelAnalysis}
              variant="secondary"
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleRunAnalysis}
            loading={isAnalyzing}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : hasKnowledge ? 'Re-run Analysis' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="warning" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Analysis Progress Bar */}
      <AnalysisProgressBar events={analysisEvents} isProcessing={isAnalyzing} />

      {analysisStatus && analysisStatus.status === 'failed' && !isAnalyzing && (
        <Alert variant="warning" className="mb-4">
          Some sources failed to analyze. Check the sources below for details.
        </Alert>
      )}

      {analysisStatus && analysisStatus.status === 'cancelled' && !isAnalyzing && (
        <Alert variant="info" className="mb-4">
          Previous analysis was cancelled. Click &quot;Run Analysis&quot; to try again.
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
            <a
              href={`/projects/${projectId}/edit?step=knowledge`}
              className="text-sm text-[color:var(--accent-selected)] hover:underline transition"
            >
              Configure sources
            </a>
          }
        >
          <SourcesSection
            sources={sources}
            isLoading={isLoading}
          />
        </Collapsible>
      </div>
    </div>
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
  const [isExporting, setIsExporting] = useState(false)

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

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/export`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to export knowledge')
      }

      // Get the blob and trigger download
      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] ?? 'knowledge-export.zip'

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export'
      console.error('[knowledge] Export failed:', message)
    } finally {
      setIsExporting(false)
    }
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

  const categories: KnowledgeCategory[] = ['business', 'product', 'technical', 'faq', 'how_to']
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

        {/* Action buttons - only show when not editing */}
        {!isEditing && (
          <div className="flex items-center gap-4">
            {packages.length > 0 && (
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="text-sm text-[color:var(--accent-selected)] hover:underline transition font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
            )}
            {activePackage && content && (
              <button
                type="button"
                onClick={handleEdit}
                className="text-sm text-[color:var(--accent-selected)] hover:underline transition font-mono"
              >
                Edit
              </button>
            )}
          </div>
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
  isLoading: boolean
}

function SourcesSection({ sources, isLoading }: SourcesSectionProps) {
  const codebaseSource = sources.find((s) => s.type === 'codebase')
  const otherSources = sources.filter((s) => s.type !== 'codebase')

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {codebaseSource && <CodebaseSourceItem source={codebaseSource} />}
      {otherSources.map((source) => (
        <SourceItem key={source.id} source={source} />
      ))}
      {!codebaseSource && otherSources.length === 0 && (
        <div className="rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] p-6 text-center">
          <p className="text-sm text-[color:var(--text-secondary)]">
            No knowledge sources configured.
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Source Items
// ============================================================================

interface CodebaseSourceItemProps {
  source: KnowledgeSourceRecord
}

function CodebaseSourceItem({ source }: CodebaseSourceItemProps) {
  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
    pending: 'default',
    processing: 'info',
    completed: 'success',
    failed: 'warning',
  }

  return (
    <div className="flex items-center justify-between rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant="default">Codebase</Badge>
        <span className="text-sm text-[color:var(--foreground)]">
          {source.analysis_scope ? `Project source code (${source.analysis_scope})` : 'Project source code'}
        </span>
        <Badge variant={statusColors[source.status] ?? 'default'}>
          {source.status}
        </Badge>
      </div>
    </div>
  )
}

interface SourceItemProps {
  source: KnowledgeSourceRecord
}

function SourceItem({ source }: SourceItemProps) {
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
      {source.error_message && (
        <span className="text-xs text-[color:var(--accent-danger)]" title={source.error_message}>
          Error
        </span>
      )}
    </div>
  )
}
