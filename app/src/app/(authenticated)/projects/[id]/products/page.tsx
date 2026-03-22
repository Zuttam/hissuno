'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { useProject } from '@/components/providers/project-provider'
import { useProductScopes } from '@/hooks/use-product-scopes'
import { ProductScopeList } from '@/components/projects/products/product-scope-list'
import { ProductScopeSidebar } from '@/components/projects/products/product-scope-sidebar'
import { PageHeader, Spinner, Input } from '@/components/ui'
import { saveProductScopes } from '@/lib/api/settings'
import type { ProductScopeRecord, ProductScopeType } from '@/types/product-scope'
import type { TagColorVariant } from '@/types/session'

export default function ProductsPage() {
  const searchParams = useSearchParams()
  const { projectId, isLoading: isLoadingProject } = useProject()
  const { scopes, isLoading, refresh } = useProductScopes({ projectId: projectId ?? undefined })

  const [searchQuery, setSearchQuery] = useState('')
  const [isAddingScope, setIsAddingScope] = useState(false)
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(
    searchParams.get('area')
  )

  const selectedScope = useMemo(
    () => scopes.find((s) => s.id === selectedScopeId) ?? null,
    [scopes, selectedScopeId]
  )

  const handleAdd = useCallback(async (newScope: { name: string; slug: string; description: string; color: TagColorVariant; type: ProductScopeType }) => {
    if (!projectId) return
    const tempScope = {
      id: `temp_${Date.now()}`,
      name: newScope.name,
      slug: newScope.slug,
      description: newScope.description,
      color: newScope.color,
      position: scopes.length,
      is_default: false,
      type: newScope.type,
      goals: null,
    }
    const updated = [...scopes, tempScope]
    await saveProductScopes(projectId, updated)
    await refresh()
  }, [projectId, scopes, refresh])

  const handleSave = useCallback(async (updatedScope: ProductScopeRecord) => {
    if (!projectId) return
    const updated = scopes.map((s) => (s.id === updatedScope.id ? updatedScope : s))
    await saveProductScopes(projectId, updated)
    await refresh()
  }, [projectId, scopes, refresh])

  const handleDelete = useCallback(async (scopeId: string) => {
    if (!projectId) return
    const updated = scopes
      .filter((s) => s.id !== scopeId)
      .map((s, i) => ({ ...s, position: i }))
    await saveProductScopes(projectId, updated)
    setSelectedScopeId(null)
    await refresh()
  }, [projectId, scopes, refresh])

  if (isLoadingProject || !projectId) {
    return (
      <>
        <PageHeader title="Product Areas & Initiatives" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Product Areas & Initiatives"
        actions={
          <button
            type="button"
            onClick={() => setIsAddingScope(true)}
            disabled={scopes.length >= 20}
            className="flex items-center gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            Add Scope
          </button>
        }
      />

      <div className="flex flex-1 flex-col gap-4">
        {/* Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center">
            <Search size={10} className="pointer-events-none absolute left-2 text-[color:var(--text-tertiary)]" />
            <Input
              type="text"
              placeholder="Search product scopes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-6 w-64 rounded-full border border-[color:var(--border-subtle)] bg-transparent py-0 pl-6 pr-2 text-[10px]"
            />
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : (
          <ProductScopeList
            scopes={scopes}
            selectedScopeId={selectedScopeId}
            onSelect={setSelectedScopeId}
            onAdd={handleAdd}
            searchQuery={searchQuery}
            isAdding={isAddingScope}
            onAddingChange={setIsAddingScope}
          />
        )}
      </div>

      {/* Detail sidebar */}
      {selectedScope && (
        <ProductScopeSidebar
          scope={selectedScope}
          projectId={projectId}
          onClose={() => setSelectedScopeId(null)}
          onSave={(updated) => void handleSave(updated)}
          onDelete={(id) => void handleDelete(id)}
        />
      )}
    </>
  )
}
