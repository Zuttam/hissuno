'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Plus, Search, FolderPlus } from 'lucide-react'
import Image from 'next/image'
import { useProject } from '@/components/providers/project-provider'
import { useProductScopes } from '@/hooks/use-product-scopes'
import { useKnowledgeSources } from '@/hooks/use-knowledge-sources'
import { KnowledgeSourceTree } from '@/components/projects/knowledge/knowledge-source-tree'
import { KnowledgeSourceSidebar } from '@/components/projects/knowledge/knowledge-source-sidebar'
import { reanalyzeKnowledgeSource } from '@/lib/api/knowledge'
import { fetchGithubStatus } from '@/lib/api/plugins'
import { PageHeader, Spinner, FilterChip, FilterLabel, Input } from '@/components/ui'
import { type KnowledgeSourceType, getSourceTypeLabel } from '@/lib/knowledge/types'
import { useCustomFields } from '@/hooks/use-custom-fields'

const ADD_SOURCE_TYPES: { type: KnowledgeSourceType; icon: React.ReactNode; label: string }[] = [
  { type: 'codebase', icon: <Image src="/logos/github.svg" alt="GitHub" width={16} height={16} />, label: 'Codebase' },
  { type: 'website', icon: <span className="text-sm">🌐</span>, label: 'Website' },
  { type: 'docs_portal', icon: <span className="text-sm">📚</span>, label: 'Documentation' },
  { type: 'uploaded_doc', icon: <span className="text-sm">📄</span>, label: 'Documents' },
  { type: 'raw_text', icon: <span className="text-sm">📝</span>, label: 'Custom Text' },
]

export default function KnowledgePage() {
  const { projectId, isLoading: isLoadingProject } = useProject()
  const { scopes: productScopes, isLoading: isLoadingScopes } = useProductScopes({ projectId: projectId ?? undefined })

  const [filterAreaIds, setFilterAreaIds] = useState<string[]>([])
  const [filterTypes, setFilterTypes] = useState<KnowledgeSourceType[]>([])
  const [filterCustomFields, setFilterCustomFields] = useState<Record<string, string[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [addingType, setAddingType] = useState<KnowledgeSourceType | null>(null)
  const [addDropdownOpen, setAddDropdownOpen] = useState(false)
  const addDropdownRef = useRef<HTMLDivElement | null>(null)
  const [githubConnected, setGithubConnected] = useState(false)

  const { fields: customFieldDefs } = useCustomFields({
    projectId: projectId ?? undefined,
    entityType: 'knowledge_source',
  })

  const { sources, isLoading, updateSource, deleteSource, addSource, refresh } = useKnowledgeSources({
    projectId: projectId ?? '',
  })

  // Poll while any source is in-flight so the UI reflects pending/analyzing → done/failed
  // transitions without SSE. Matches the session-ingestion UX pattern.
  const hasInFlightSource = useMemo(
    () => sources.some((s) => s.status === 'pending' || s.status === 'analyzing'),
    [sources],
  )
  useEffect(() => {
    if (!hasInFlightSource) return
    const interval = setInterval(() => { void refresh() }, 2500)
    return () => clearInterval(interval)
  }, [hasInFlightSource, refresh])

  // Close add dropdown on outside click / escape
  useEffect(() => {
    if (!addDropdownOpen) return
    function handlePointerDown(event: PointerEvent) {
      if (!addDropdownRef.current?.contains(event.target as Node)) {
        setAddDropdownOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAddDropdownOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [addDropdownOpen])

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

  // Source analysis is fire-and-forget: the create route kicks off background
  // processing (when the source type needs fetching) and the poll above
  // surfaces status transitions. No reconnect/stream plumbing required.
  const handleAddSource = useCallback(async (data: FormData | Record<string, unknown>) => {
    const source = await addSource(data)
    if (source) {
      setAddingType(null)
      setSelectedSourceId(source.id)
    }
    return source
  }, [addSource])

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

  const handleCustomFieldToggle = useCallback((fieldKey: string, value: string) => {
    setFilterCustomFields(prev => {
      const current = prev[fieldKey] ?? []
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      if (next.length === 0) {
        const { [fieldKey]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [fieldKey]: next }
    })
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
    // Custom field filters (AND between fields, OR within field values)
    for (const [fieldKey, selectedValues] of Object.entries(filterCustomFields)) {
      if (selectedValues.length > 0) {
        result = result.filter(s => {
          const cf = (s.custom_fields as Record<string, unknown>) ?? {}
          const fieldValue = cf[fieldKey]
          if (Array.isArray(fieldValue)) {
            return fieldValue.some(v => selectedValues.includes(String(v)))
          }
          return fieldValue != null && selectedValues.includes(String(fieldValue))
        })
      }
    }
    return result
  }, [sources, filterTypes, filterAreaIds, defaultAreaId, searchQuery, filterCustomFields])

  // Get selected source object (returns null if source was deleted)
  const selectedSource = useMemo(
    () => sources.find(s => s.id === selectedSourceId) ?? null,
    [sources, selectedSourceId]
  )

  const handleAdd = useCallback((type: KnowledgeSourceType) => {
    setSelectedSourceId(null)
    setAddingType(type)
  }, [])

  const handleCreateFolder = useCallback(async (parentId?: string | null) => {
    const source = await addSource({ type: 'folder', name: 'Untitled folder', parent_id: parentId ?? null })
    if (source) {
      setSelectedSourceId(source.id)
    }
  }, [addSource])

  const handleAnalyze = useCallback(async (sourceId: string) => {
    if (!projectId) return
    try {
      await reanalyzeKnowledgeSource(projectId, sourceId)
    } catch (err) {
      console.error('[knowledge-page] reanalyze failed', err)
    }
    void refresh()
  }, [projectId, refresh])

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
      <PageHeader
        title="Knowledge"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCreateFolder()}
              className="flex items-center gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
            >
              <FolderPlus size={14} />
              New Folder
            </button>
            <div className="relative" ref={addDropdownRef}>
              <button
                type="button"
                onClick={() => setAddDropdownOpen(prev => !prev)}
                className="flex items-center gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
              >
                <Plus size={14} />
                Add Knowledge
              </button>
              {addDropdownOpen && (
                <div className="absolute right-0 z-50 mt-1 min-w-[180px] rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-1 shadow-lg">
                  {ADD_SOURCE_TYPES.map(({ type, icon, label }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setAddDropdownOpen(false)
                        handleAdd(type)
                      }}
                      className="flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-xs text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-hover)]"
                    >
                      <span className="flex items-center shrink-0">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        }
      />

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
          {customFieldDefs
            .filter(f => (f.field_type === 'select' || f.field_type === 'multi_select') && f.select_options?.length)
            .map(f => (
              <div key={f.id} className="flex flex-wrap items-center gap-1.5">
                <FilterLabel>{f.field_label}:</FilterLabel>
                {(f.select_options ?? []).map((opt) => (
                  <FilterChip
                    key={opt}
                    label={opt}
                    active={(filterCustomFields[f.field_key] ?? []).includes(opt)}
                    onClick={() => handleCustomFieldToggle(f.field_key, opt)}
                  />
                ))}
              </div>
            ))}
        </div>

        {/* Source list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : (
          <KnowledgeSourceTree
            sources={filteredSources}
            selectedSourceId={selectedSourceId}
            onSelect={(id) => {
              setAddingType(null)
              setSelectedSourceId(id)
            }}
            onUpdate={updateSource}
            onDelete={deleteSource}
            onCreateFolder={handleCreateFolder}
            productScopes={productScopes}
            githubConnected={githubConnected}
          />
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
          isAnalyzing={selectedSource.status === 'analyzing'}
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
        />
      )}
    </>
  )
}
