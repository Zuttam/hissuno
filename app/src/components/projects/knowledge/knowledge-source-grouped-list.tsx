'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui'
import type { KnowledgeSourceType, KnowledgeSourceWithCodebase } from '@/lib/knowledge/types'
import { getSourceDisplayValue } from '@/lib/knowledge/types'
import type { ProductScopeRecord } from '@/types/product-scope'

interface KnowledgeSourceGroupedListProps {
  sources: KnowledgeSourceWithCodebase[]
  selectedSourceId: string | null
  onSelect: (sourceId: string) => void
  productScopes?: ProductScopeRecord[]
  githubConnected?: boolean
}

export interface SourceTypeConfig {
  icon: React.ReactNode
  label: string
  order: number
}

export const SOURCE_TYPE_CONFIG: Record<KnowledgeSourceType, SourceTypeConfig> = {
  codebase: {
    icon: <Image src="/logos/github.svg" alt="GitHub" width={16} height={16} />,
    label: 'Codebase',
    order: 0,
  },
  website: { icon: <span className="text-sm">🌐</span>, label: 'Website', order: 1 },
  docs_portal: { icon: <span className="text-sm">📚</span>, label: 'Documentation', order: 2 },
  uploaded_doc: { icon: <span className="text-sm">📄</span>, label: 'Documents', order: 3 },
  raw_text: { icon: <span className="text-sm">📝</span>, label: 'Custom Text', order: 4 },
  notion: {
    icon: <Image src="/logos/notion.svg" alt="Notion" width={16} height={16} className="dark:invert" />,
    label: 'Notion',
    order: 5,
  },
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  done: { color: 'var(--accent-success)', label: 'Analyzed' },
  analyzing: { color: 'var(--accent-warning)', label: 'Analyzing' },
  failed: { color: 'var(--accent-danger)', label: 'Failed' },
  pending: { color: 'var(--text-tertiary)', label: 'Pending' },
}

function getSourceName(source: KnowledgeSourceWithCodebase): string {
  if (source.name) return source.name

  if (source.type === 'codebase' && source.source_code?.repository_url) {
    const match = source.source_code.repository_url.match(/github\.com\/([^/]+\/[^/]+)/)
    const repoName = match ? match[1] : source.source_code.repository_url
    const branch = source.source_code.repository_branch ?? 'main'
    return `${repoName} (${branch})`
  }

  return getSourceDisplayValue(source)
}

export const ALL_TYPES: KnowledgeSourceType[] = ['codebase', 'website', 'docs_portal', 'uploaded_doc', 'raw_text']

export function KnowledgeSourceGroupedList({
  sources,
  selectedSourceId,
  onSelect,
  productScopes,
  githubConnected,
}: KnowledgeSourceGroupedListProps) {
  const [collapsedTypes, setCollapsedTypes] = useState<Set<KnowledgeSourceType>>(new Set())

  const toggleCollapse = (type: KnowledgeSourceType) => {
    setCollapsedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const groupedSources = ALL_TYPES.map(type => ({
    type,
    config: SOURCE_TYPE_CONFIG[type],
    sources: sources.filter(s => s.type === type || (type === 'uploaded_doc' && s.type === 'notion')),
  }))

  return (
    <div className="flex flex-col gap-1">
      {groupedSources.map(({ type, config, sources: typeSources }) => {
        const isCollapsed = collapsedTypes.has(type)

        return (
          <div key={type}>
            {/* Section header */}
            <div className="flex items-center gap-2 py-1.5">
              <button
                type="button"
                onClick={() => toggleCollapse(type)}
                className="flex items-center gap-2 flex-1 text-left rounded-[4px] py-0.5 transition hover:bg-[color:var(--surface-hover)]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-[color:var(--text-tertiary)] transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="flex items-center shrink-0">{config.icon}</span>
                <span className="text-xs font-medium text-[color:var(--text-secondary)] uppercase tracking-wide">
                  {config.label}
                </span>
                {typeSources.length > 0 && (
                  <span className="text-xs text-[color:var(--text-tertiary)]">
                    ({typeSources.length})
                  </span>
                )}
              </button>
            </div>

            {/* Source items */}
            {!isCollapsed && typeSources.length > 0 && (
              <div className="flex flex-col gap-0.5 pl-2">
                {typeSources.map(source => {
                  const isSelected = source.id === selectedSourceId
                  const statusConfig = STATUS_CONFIG[source.status] ?? STATUS_CONFIG.pending
                  const scopeName = productScopes?.find(a => a.id === source.product_scope_id)?.name

                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => onSelect(source.id)}
                      className={`flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-left transition ${
                        isSelected
                          ? 'bg-[color:var(--accent-selected)]/10 border border-[color:var(--accent-selected)]/30'
                          : 'hover:bg-[color:var(--surface-hover)] border border-transparent'
                      }`}
                    >
                      {/* Status dot */}
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: statusConfig.color }}
                        title={statusConfig.label}
                      />

                      {/* Name */}
                      <span className="flex-1 truncate text-sm text-[color:var(--foreground)]">
                        {getSourceName(source)}
                      </span>

                      {/* Added timestamp */}
                      <span className="shrink-0 text-[10px] text-[color:var(--text-tertiary)]">
                        {source.created_at ? new Date(source.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                      </span>

                      {/* Product scope badge */}
                      {scopeName && (
                        <Badge variant="info" className="text-[10px] shrink-0">{scopeName}</Badge>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Empty state for codebase when not connected */}
            {!isCollapsed && type === 'codebase' && typeSources.length === 0 && !githubConnected && (
              <p className="px-8 py-1 text-xs text-[color:var(--text-tertiary)]">
                Connect GitHub to add your codebase
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
