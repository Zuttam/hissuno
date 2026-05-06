'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { useProject } from '@/components/providers/project-provider'
import { useProductScopes } from '@/hooks/use-product-scopes'
import { ProductScopeList } from '@/components/projects/products/product-scope-list'
import { ProductScopeSidebar } from '@/components/projects/products/product-scope-sidebar'
import { KnowledgeList } from '@/components/projects/products/knowledge-list'
import { KnowledgeSidebar } from '@/components/projects/products/knowledge-sidebar'
import { PageHeader, Spinner, Input } from '@/components/ui'
import { createProductScope, updateProductScope, saveProductScopes } from '@/lib/api/settings'
import type { ProductScopeType, ProductScopeGoal } from '@/types/product-scope'
import type { TagColorVariant } from '@/types/session'

export default function ProductsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { projectId, isLoading: isLoadingProject } = useProject()
  const { scopes, isLoading, refresh } = useProductScopes({ projectId: projectId ?? undefined })

  const [searchQuery, setSearchQuery] = useState('')
  const [isCreatingScope, setIsCreatingScope] = useState(false)
  const [isEditingScope, setIsEditingScope] = useState(false)
  const [isCreatingKnowledge, setIsCreatingKnowledge] = useState(false)
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(
    searchParams.get('scope') ?? searchParams.get('area')
  )
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(
    searchParams.get('knowledge')
  )

  const knowledgeRefreshRef = useRef<() => Promise<void>>(async () => {})
  const registerKnowledgeRefresh = useCallback((fn: () => Promise<void>) => {
    knowledgeRefreshRef.current = fn
  }, [])

  const selectedScope = useMemo(
    () => scopes.find((s) => s.id === selectedScopeId) ?? null,
    [scopes, selectedScopeId]
  )

  // Auto-select the first (default) scope once scopes load and nothing is selected.
  useEffect(() => {
    if (selectedScopeId || scopes.length === 0) return
    const defaultScope = scopes.find((s) => s.is_default) ?? scopes[0]
    if (defaultScope) setSelectedScopeId(defaultScope.id)
  }, [scopes, selectedScopeId])

  // Sync URL with selection (replace, no history pollution).
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('area')
    if (selectedScopeId) params.set('scope', selectedScopeId)
    else params.delete('scope')
    if (selectedKnowledgeId) params.set('knowledge', selectedKnowledgeId)
    else params.delete('knowledge')
    const next = params.toString()
    const currentTrimmed = searchParams.toString().replace(/(^|&)area=[^&]*/g, '').replace(/^&/, '')
    if (next !== currentTrimmed) {
      router.replace(`${pathname}${next ? `?${next}` : ''}`, { scroll: false })
    }
  }, [selectedScopeId, selectedKnowledgeId, pathname, router, searchParams])

  const handleSelectScope = useCallback((scopeId: string) => {
    setSelectedScopeId(scopeId)
    setSelectedKnowledgeId(null)
    setIsCreatingKnowledge(false)
    setIsEditingScope(false)
  }, [])

  const handleSelectKnowledge = useCallback((sourceId: string) => {
    setSelectedKnowledgeId(sourceId)
    setIsCreatingKnowledge(false)
    setIsEditingScope(false)
  }, [])

  const handleCreateScope = useCallback(async (newScope: {
    name: string
    slug: string
    description: string
    color: TagColorVariant
    type: ProductScopeType
    goals: ProductScopeGoal[] | null
    parent_id?: string | null
    custom_fields?: Record<string, unknown>
  }) => {
    if (!projectId) return
    await createProductScope(projectId, {
      name: newScope.name,
      slug: newScope.slug,
      description: newScope.description,
      color: newScope.color,
      type: newScope.type,
      goals: newScope.goals,
      parent_id: newScope.parent_id,
      custom_fields: newScope.custom_fields,
    })
    setIsCreatingScope(false)
    await refresh()
  }, [projectId, refresh])

  const handleUpdateScope = useCallback(async (updates: Record<string, unknown>): Promise<boolean> => {
    if (!projectId || !selectedScopeId) return false
    try {
      await updateProductScope(projectId, selectedScopeId, updates)
      await refresh()
      return true
    } catch (err) {
      console.error('[products-page] update failed:', err)
      return false
    }
  }, [projectId, selectedScopeId, refresh])

  const handleDeleteScope = useCallback(async (scopeId: string) => {
    if (!projectId) return
    const updated = scopes
      .filter((s) => s.id !== scopeId)
      .map((s, i) => ({ ...s, position: i }))
    await saveProductScopes(projectId, updated)
    setSelectedScopeId(null)
    setIsEditingScope(false)
    await refresh()
  }, [projectId, scopes, refresh])

  if (isLoadingProject || !projectId) {
    return (
      <>
        <PageHeader title="Scopes" />
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Scopes"
        actions={
          <button
            type="button"
            onClick={() => { setIsCreatingScope(true); setIsEditingScope(false) }}
            disabled={scopes.length >= 50}
            className="flex items-center gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} />
            Add Scope
          </button>
        }
      />

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left: scope nav */}
        <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto pr-3">
          <div className="relative flex items-center">
            <Search size={10} className="pointer-events-none absolute left-2 text-[color:var(--text-tertiary)]" />
            <Input
              type="text"
              placeholder="Search scopes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-full rounded-full border border-[color:var(--border-subtle)] bg-transparent py-0 pl-6 pr-2 text-[10px]"
            />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : (
            <ProductScopeList
              scopes={scopes}
              selectedScopeId={selectedScopeId}
              onSelect={handleSelectScope}
              searchQuery={searchQuery}
              variant="nav"
            />
          )}
        </aside>

        {/* Main: knowledge for selected scope */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {selectedScope ? (
            <KnowledgeList
              key={selectedScope.id}
              projectId={projectId}
              scope={selectedScope}
              selectedKnowledgeId={selectedKnowledgeId}
              onSelect={handleSelectKnowledge}
              onCreate={() => { setIsCreatingKnowledge(true); setSelectedKnowledgeId(null) }}
              onEditScope={() => { setIsEditingScope(true); setSelectedKnowledgeId(null); setIsCreatingKnowledge(false) }}
              registerRefresh={registerKnowledgeRefresh}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-[color:var(--text-tertiary)]">
              {scopes.length === 0
                ? 'No scopes yet. Click "Add Scope" to get started.'
                : 'Select a scope on the left to see its knowledge.'}
            </div>
          )}
        </div>
      </div>

      {/* Knowledge detail/create sidebar */}
      {selectedScope && selectedKnowledgeId && !isCreatingKnowledge && (
        <KnowledgeSidebar
          mode="edit"
          projectId={projectId}
          scopeId={selectedScope.id}
          sourceId={selectedKnowledgeId}
          onClose={() => setSelectedKnowledgeId(null)}
          onChange={() => { void knowledgeRefreshRef.current() }}
          onDeleted={() => {
            setSelectedKnowledgeId(null)
            void knowledgeRefreshRef.current()
          }}
        />
      )}

      {selectedScope && isCreatingKnowledge && (
        <KnowledgeSidebar
          mode="create"
          projectId={projectId}
          scopeId={selectedScope.id}
          onClose={() => setIsCreatingKnowledge(false)}
          onCreated={(newId) => {
            setIsCreatingKnowledge(false)
            setSelectedKnowledgeId(newId)
            void knowledgeRefreshRef.current()
          }}
        />
      )}

      {/* Scope edit drawer (opened via "Edit scope" button) */}
      {selectedScope && isEditingScope && !isCreatingScope && (
        <ProductScopeSidebar
          scope={selectedScope}
          projectId={projectId}
          allScopes={scopes}
          onClose={() => setIsEditingScope(false)}
          onUpdate={handleUpdateScope}
          onDelete={(id) => void handleDeleteScope(id)}
        />
      )}

      {/* Scope create drawer */}
      {isCreatingScope && (
        <ProductScopeSidebar
          projectId={projectId}
          allScopes={scopes}
          onClose={() => setIsCreatingScope(false)}
          onCreate={(newScope) => void handleCreateScope(newScope)}
          existingSlugs={scopes.map((s) => s.slug)}
        />
      )}
    </>
  )
}
