'use client'

import { useEffect } from 'react'
import { Plus, Pencil, Target } from 'lucide-react'
import { Badge, Spinner } from '@/components/ui'
import { useEntityRelationships } from '@/hooks/use-entity-relationships'
import { formatRelativeTime } from '@/lib/utils/format-time'
import { KnowledgeTypeIcon } from '@/components/projects/products/knowledge-sidebar'
import {
  type KnowledgeSourceType,
  type KnowledgeSourceStatus,
  getSourceTypeLabel,
} from '@/lib/knowledge/types'
import type { ProductScopeRecord } from '@/types/product-scope'

interface KnowledgeListProps {
  projectId: string
  scope: ProductScopeRecord
  selectedKnowledgeId: string | null
  onSelect: (sourceId: string) => void
  onCreate: () => void
  onEditScope: () => void
  registerRefresh: (refresh: () => Promise<void>) => void
}

function statusVariant(status: KnowledgeSourceStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'done') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'analyzing') return 'info'
  return 'warning'
}

export function KnowledgeList({
  projectId,
  scope,
  selectedKnowledgeId,
  onSelect,
  onCreate,
  onEditScope,
  registerRefresh,
}: KnowledgeListProps) {
  const { relationships, isLoading, refresh } = useEntityRelationships({
    projectId,
    entityType: 'product_scope',
    entityId: scope.id,
  })

  useEffect(() => {
    registerRefresh(refresh)
  }, [registerRefresh, refresh])

  const sources = relationships.knowledgeSources

  return (
    <div className="flex flex-1 flex-col">
      {/* Sub-header for the selected scope */}
      <div className="flex items-start justify-between gap-3 border-b-2 border-[color:var(--border-subtle)] pb-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Badge variant={scope.color}>{scope.name}</Badge>
            {scope.description && (
              <span className="truncate text-xs text-[color:var(--text-tertiary)]">
                {scope.description}
              </span>
            )}
          </div>
          {scope.goals && scope.goals.length > 0 && (
            <ul className="flex flex-col gap-0.5 pl-0.5">
              {scope.goals.map((goal) => (
                <li
                  key={goal.id}
                  className="flex items-start gap-1.5 text-xs text-[color:var(--text-secondary)]"
                >
                  <Target size={11} className="mt-0.5 shrink-0 text-[color:var(--text-tertiary)]" />
                  <span className="min-w-0">{goal.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEditScope}
            className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
          >
            <Pencil size={12} />
            <span>Edit scope</span>
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
          >
            <Plus size={12} />
            <span>Add knowledge</span>
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm text-[color:var(--text-secondary)]">
            No knowledge in this scope yet.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="text-xs text-[color:var(--accent-primary)] hover:underline"
          >
            Add the first source
          </button>
        </div>
      ) : (
        <div className="flex flex-col">
          {sources.map((source) => {
            const isSelected = selectedKnowledgeId === source.id
            return (
              <button
                key={source.id}
                type="button"
                onClick={() => onSelect(source.id)}
                className={`flex items-center gap-3 border-b border-[color:var(--border-subtle)] px-3 py-2.5 text-left transition ${
                  isSelected
                    ? 'bg-[color:var(--surface-selected)]'
                    : 'hover:bg-[color:var(--surface-hover)]'
                }`}
              >
                <KnowledgeTypeIcon type={source.type as KnowledgeSourceType} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm text-[color:var(--foreground)]">
                    {source.name || 'Untitled source'}
                  </span>
                  <span className="truncate text-xs text-[color:var(--text-tertiary)]">
                    {getSourceTypeLabel(source.type as KnowledgeSourceType)}
                  </span>
                </div>
                <Badge variant={statusVariant(source.status as KnowledgeSourceStatus)}>
                  {source.status}
                </Badge>
                {source.linkedAt && (
                  <span className="shrink-0 text-[10px] tabular-nums text-[color:var(--text-tertiary)]">
                    {formatRelativeTime(source.linkedAt)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
