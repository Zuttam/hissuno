'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Search } from 'lucide-react'
import { useProject } from '@/components/providers/project-provider'
import { useProductScopes } from '@/hooks/use-product-scopes'
import { useKnowledgeSources } from '@/hooks/use-knowledge-sources'
import { useSourceAnalysis } from '@/hooks/use-source-analysis'
import { KnowledgeSourceGroupedList } from '@/components/projects/knowledge/knowledge-source-grouped-list'
import { KnowledgeSourceSidebar } from '@/components/projects/knowledge/knowledge-source-sidebar'
import { fetchGithubStatus } from '@/lib/api/integrations'
import { PageHeader, Spinner, FilterChip, FilterLabel, Input } from '@/components/ui'
import { type KnowledgeSourceType, getSourceTypeLabel } from '@/lib/knowledge/types'

export default function KnowledgePage() {
  const { projectId, isLoading: isLoadingProject } = useProject()
  const { scopes: productScopes, isLoading: isLoadingScopes } = useProductScopes({ projectId: projectId ?? undefined })

  const [filterAreaIds, setFilterAreaIds] = useState<string[]>([])
  const [filterTypes, setFilterTypes] = useState<KnowledgeSourceType[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [addingType, setAddingType] = useState<KnowledgeSourceType | null>(null)
  const [githubConnected, setGithubConnected] = useState(false)

  const { sources, isLoading, updateSource, deleteSource, addSource, refresh } = useKnowledgeSources({
    projectId: projectId ?? '',
  })

  const {
    isAnalyzing: isSourceAnalyzing,
    analyzingSourceId,
    events: analysisEvents,
    startAnalysis,
    reconnectToStream,
  } = useSourceAnalysis({
    projectId: projectId ?? '',
    onComplete: () => void refresh(),
  })

  // Check GitHub status on mount
  useEffect(() => {
    if (!projectId) return
    const checkGitHub = async () => {
      try {
        const res = await fetchGithubStatus(projectId)
        if (res.ok) {
          const data = await res.json()
          setGithubConnected(data.connected)
        }
      } catch {
        // Silent
      }
    }
    void checkGitHub()
  }, [projectId])

  // Auto-reconnect to in-progress analysis after page refresh
  const hasReconnected = useRef(false)
  useEffect(() => {
    if (isLoading || hasReconnected.current || isSourceAnalyzing) return
    const analyzingSource = sources.find(s => s.status === 'analyzing')
    if (analyzingSource) {
      hasReconnected.current = true
      setSelectedSourceId(analyzingSource.id)
      reconnectToStream(analyzingSource.id)
    }
  }, [sources, isLoading, isSourceAnalyzing, reconnectToStream])

  // Auto-start analysis after adding a source
  const handleAddSource = useCallback(async (data: FormData | Record<string, unknown>) => {
    const source = await addSource(data)
    if (source) {
      setAddingType(null)
      setSelectedSourceId(source.id)
      void startAnalysis(source.id)
    }
    return source
  }, [addSource, startAnalysis])

  const defaultAreaId = useMemo(
    () => productScopes.find(a => a.is_default)?.id,
    [productScopes]
  )

  const handleAreaToggle = useCallback((areaId: string) => {
    setFilterAreaIds(prev =>
      prev.includes(areaId) ? prev.filter(id => id !== areaId) : [...prev, areaId]
    )
  }, [])

  const handleTypeToggle = useCallback((type: KnowledgeSourceType) => {
    setFilterTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }, [])

  // Filter sources by type, product area, and search query
  const filteredSources = useMemo(() => {
    let result = sources
    if (filterTypes.length > 0) {
      result = result.filter(s => filterTypes.includes(s.type))
    }
    if (filterAreaIds.length > 0) {
      result = result.filter(s => {
        const effectiveAreaId = s.product_scope_id ?? defaultAreaId
        return effectiveAreaId ? filterAreaIds.includes(effectiveAreaId) : false
      })
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(s =>
        s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
      )
    }
    return result
  }, [sources, filterTypes, filterAreaIds, defaultAreaId, searchQuery])

  // Get selected source object (returns null if source was deleted)
  const selectedSource = useMemo(
    () => sources.find(s => s.id === selectedSourceId) ?? null,
    [sources, selectedSourceId]
  )

  const handleAdd = useCallback((type: KnowledgeSourceType) => {
    setSelectedSourceId(null)
    setAddingType(type)
  }, [])

  const handleAnalyze = useCallback(async (sourceId: string) => {
    await startAnalysis(sourceId)
  }, [startAnalysis])

  if (isLoadingProject || !projectId) {
    return (
      <>
        <PageHeader title="Knowledge" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Knowledge" />

      <div className="flex flex-1 flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">Filters</span>
          <div className="relative flex items-center">
            <Search size={10} className="pointer-events-none absolute left-2 text-[color:var(--text-tertiary)]" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-6 w-48 rounded-full border border-[color:var(--border-subtle)] bg-transparent py-0 pl-6 pr-2 text-[10px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterLabel>Type:</FilterLabel>
            {(['codebase', 'website', 'docs_portal', 'uploaded_doc', 'raw_text'] as const).map((type) => (
              <FilterChip
                key={type}
                label={getSourceTypeLabel(type)}
                active={filterTypes.includes(type)}
                onClick={() => handleTypeToggle(type)}
              />
            ))}
          </div>
          {!isLoadingScopes && productScopes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterLabel>Area:</FilterLabel>
              {productScopes.map((area) => (
                <FilterChip
                  key={area.id}
                  label={area.name}
                  active={filterAreaIds.includes(area.id)}
                  onClick={() => handleAreaToggle(area.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Source list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : (
          <>
            <KnowledgeSourceGroupedList
              sources={filteredSources}
              selectedSourceId={selectedSourceId}
              onSelect={(id) => {
                setAddingType(null)
                setSelectedSourceId(id)
              }}
              onAdd={handleAdd}
              productScopes={productScopes}
              githubConnected={githubConnected}
            />

            {sources.length === 0 && (
              <p className="text-sm text-[color:var(--text-tertiary)] py-4 text-center">
                No sources configured yet. Click the + button on any section above to add a knowledge source.
              </p>
            )}
          </>
        )}
      </div>

      {/* Detail sidebar (edit mode) */}
      {selectedSource && !addingType && (
        <KnowledgeSourceSidebar
          source={selectedSource}
          onClose={() => setSelectedSourceId(null)}
          onUpdate={updateSource}
          onDelete={deleteSource}
          onAnalyze={handleAnalyze}
          isAnalyzing={isSourceAnalyzing && analyzingSourceId === selectedSource.id}
          analysisEvents={isSourceAnalyzing && analyzingSourceId === selectedSource.id ? analysisEvents : undefined}
          productScopes={productScopes}
        />
      )}

      {/* Create sidebar */}
      {addingType && projectId && (
        <KnowledgeSourceSidebar
          createType={addingType}
          projectId={projectId}
          onClose={() => setAddingType(null)}
          onAdd={handleAddSource}
          productScopes={productScopes}
        />
      )}
    </>
  )
}
