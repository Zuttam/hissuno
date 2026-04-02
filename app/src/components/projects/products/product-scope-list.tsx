'use client'

import { Badge } from '@/components/ui'
import { ScopeTypeIcon } from '@/components/projects/products/product-scope-sidebar'
import type { ProductScopeRecord } from '@/types/product-scope'
import type { TagColorVariant } from '@/types/session'

const MAX_SCOPES = 20

interface ProductScopeListProps {
  scopes: ProductScopeRecord[]
  selectedScopeId: string | null
  onSelect: (scopeId: string) => void
  searchQuery: string
}

export function ProductScopeList({
  scopes,
  selectedScopeId,
  onSelect,
  searchQuery,
}: ProductScopeListProps) {
  const filtered = searchQuery.trim()
    ? scopes.filter((a) => a.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : scopes

  return (
    <div className="flex flex-col gap-2">
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-[color:var(--text-tertiary)]">
          {searchQuery.trim()
            ? 'No product scopes match your search.'
            : 'No product scopes defined yet. Click "Add Scope" above to get started.'}
        </p>
      )}

      {filtered.map((scope) => (
        <button
          key={scope.id}
          type="button"
          onClick={() => onSelect(scope.id)}
          className={`flex items-center gap-3 rounded-lg p-3 text-left transition ${
            selectedScopeId === scope.id
              ? 'bg-[color:var(--surface-selected)] ring-1 ring-[color:var(--accent-selected)]'
              : 'bg-[color:var(--background-secondary)] hover:bg-[color:var(--surface-hover)]'
          }`}
        >
          <ScopeTypeIcon type={scope.type} size={16} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge variant={scope.color as TagColorVariant}>{scope.name}</Badge>
              {scope.is_default && (
                <span className="text-xs text-[color:var(--text-tertiary)]">(default)</span>
              )}
            </div>
            {scope.description && (
              <p className="line-clamp-2 text-xs text-[color:var(--text-secondary)]">
                {scope.description}
              </p>
            )}
            {scope.goals && scope.goals.length > 0 && (
              <p className="text-xs text-[color:var(--text-tertiary)]">
                {scope.goals.length} goal{scope.goals.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </button>
      ))}

      {/* Scope count */}
      <div className="flex items-center justify-end pt-1">
        <span className="text-xs text-[color:var(--text-tertiary)]">
          {scopes.length} / {MAX_SCOPES}
        </span>
      </div>
    </div>
  )
}
