'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useEntityRelationships } from '@/hooks/use-entity-relationships'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Combobox, type ComboboxItem } from '@/components/ui/combobox'
import { Spinner } from '@/components/ui/spinner'
import type { EntityType } from '@/lib/db/queries/types'
import type { RelatedEntitiesResult } from '@/lib/db/queries/entity-relationships'
import { fetchApi, buildUrl } from '@/lib/api/fetch'

// ---------------------------------------------------------------------------
// Type config
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<EntityType, string> = {
  company: 'Companies',
  contact: 'Contacts',
  issue: 'Issues',
  session: 'Feedback',
  knowledge_source: 'Knowledge',
  product_scope: 'Scopes',
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RelatedEntitiesSectionProps {
  projectId: string
  entityType: EntityType
  entityId: string
  allowedTypes: EntityType[]
}

export function RelatedEntitiesSection({
  projectId,
  entityType,
  entityId,
  allowedTypes,
}: RelatedEntitiesSectionProps) {
  const { relationships, isLoading, link, unlink } = useEntityRelationships({
    projectId,
    entityType,
    entityId,
  })

  const totalCount = useMemo(() => {
    let count = 0
    for (const t of allowedTypes) {
      count += getGroupItems(relationships, t).length
    }
    return count
  }, [relationships, allowedTypes])

  return (
    <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
      <CollapsibleSection
        title={`Related${!isLoading ? ` (${totalCount})` : ''}`}
        variant="flat"
        defaultExpanded={totalCount > 0}
      >
        {isLoading ? (
          <div className="flex justify-center py-2"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-3">
            {allowedTypes.map((t) => (
              <RelatedGroup
                key={t}
                projectId={projectId}
                entityType={entityType}
                entityId={entityId}
                relatedType={t}
                items={getGroupItems(relationships, t)}
                onLink={link}
                onUnlink={unlink}
              />
            ))}
            {totalCount === 0 && allowedTypes.length > 0 && (
              <p className="text-sm text-[color:var(--text-secondary)]">No related entities yet</p>
            )}
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-type group
// ---------------------------------------------------------------------------

interface GroupItem {
  id: string
  label: string
  sublabel?: string
}

function getGroupItems(
  relationships: RelatedEntitiesResult,
  type: EntityType,
): GroupItem[] {
  switch (type) {
    case 'company':
      return relationships.companies.map((c) => ({ id: c.id, label: c.name, sublabel: c.domain }))
    case 'contact':
      return relationships.contacts.map((c) => ({ id: c.id, label: c.name, sublabel: c.email }))
    case 'issue':
      return relationships.issues.map((i) => ({ id: i.id, label: i.name, sublabel: i.status ?? undefined }))
    case 'session':
      return relationships.sessions.map((s) => ({ id: s.id, label: s.name || 'Unnamed', sublabel: s.source ?? undefined }))
    case 'knowledge_source':
      return relationships.knowledgeSources.map((k) => ({ id: k.id, label: k.name || 'Unnamed', sublabel: k.type }))
    case 'product_scope':
      return relationships.productScopes.map((p) => ({ id: p.id, label: p.name }))
  }
}

function entityLink(projectId: string, type: EntityType, id: string): string {
  switch (type) {
    case 'company':
      return `/projects/${projectId}/customers?company=${id}`
    case 'contact':
      return `/projects/${projectId}/customers?contact=${id}`
    case 'issue':
      return `/projects/${projectId}/issues?issue=${id}`
    case 'session':
      return `/projects/${projectId}/sessions?session=${id}`
    case 'knowledge_source':
      return `/projects/${projectId}/settings/knowledge`
    case 'product_scope':
      return `/projects/${projectId}/products?scope=${id}`
  }
}

interface RelatedGroupProps {
  projectId: string
  entityType: EntityType
  entityId: string
  relatedType: EntityType
  items: GroupItem[]
  onLink: (targetType: EntityType, targetId: string) => Promise<boolean>
  onUnlink: (targetType: EntityType, targetId: string) => Promise<boolean>
}

function RelatedGroup({
  projectId,
  relatedType,
  items,
  onLink,
  onUnlink,
}: RelatedGroupProps) {
  const [showSearch, setShowSearch] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          {TYPE_LABELS[relatedType]}
        </span>
        <button
          type="button"
          onClick={() => setShowSearch(!showSearch)}
          className="font-mono text-[10px] text-[color:var(--accent-primary)] hover:underline"
        >
          {showSearch ? 'Cancel' : '+ Link'}
        </button>
      </div>

      {showSearch && (
        <LinkSearch
          projectId={projectId}
          relatedType={relatedType}
          existingIds={items.map((i) => i.id)}
          onSelect={async (id) => {
            await onLink(relatedType, id)
            setShowSearch(false)
          }}
        />
      )}

      {items.map((item) => (
        <div
          key={item.id}
          className="group flex items-center gap-2 rounded-[4px] px-1 py-1 text-sm transition hover:bg-[color:var(--surface-hover)]"
        >
          <Link
            href={entityLink(projectId, relatedType, item.id)}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <span className="min-w-0 flex-1 truncate text-[color:var(--foreground)]">
              {item.label}
            </span>
            {item.sublabel && (
              <span className="shrink-0 text-xs text-[color:var(--text-tertiary)]">
                {item.sublabel}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => onUnlink(relatedType, item.id)}
            className="shrink-0 text-[color:var(--text-tertiary)] opacity-0 transition hover:text-[color:var(--accent-danger)] group-hover:opacity-100"
            title="Unlink"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search component for linking
// ---------------------------------------------------------------------------

interface LinkSearchProps {
  projectId: string
  relatedType: EntityType
  existingIds: string[]
  onSelect: (id: string) => Promise<void>
}

function LinkSearch({ projectId, relatedType, existingIds, onSelect }: LinkSearchProps) {
  const [value, setValue] = useState<string | undefined>(undefined)

  const searchFn = useCallback(
    async (query: string): Promise<ComboboxItem[]> => {
      try {
        const items = await searchEntities(projectId, relatedType, query)
        return items.filter((i) => !existingIds.includes(i.value))
      } catch {
        return []
      }
    },
    [projectId, relatedType, existingIds],
  )

  return (
    <Combobox
      items={[]}
      onSearch={searchFn}
      value={value}
      onValueChange={async (val) => {
        if (val) {
          setValue(undefined)
          await onSelect(val)
        }
      }}
      placeholder={`Search ${TYPE_LABELS[relatedType].toLowerCase()}...`}
      emptyMessage="No results"
      size="sm"
    />
  )
}

const ENTITY_TO_SEARCH_TYPE: Record<EntityType, string> = {
  company: 'customers',
  contact: 'customers',
  issue: 'issues',
  session: 'feedback',
  knowledge_source: 'knowledge',
  product_scope: 'scopes',
}

const ENTITY_TO_SUBTYPE: Partial<Record<EntityType, string>> = {
  company: 'company',
  contact: 'contact',
}

export async function searchEntities(
  projectId: string,
  type: EntityType,
  query: string,
): Promise<ComboboxItem[]> {
  const searchType = ENTITY_TO_SEARCH_TYPE[type]
  const subtypeFilter = ENTITY_TO_SUBTYPE[type]

  const data = await fetchApi<{
    results: Array<{ id: string; name: string; subtype?: string }>
  }>(buildUrl('/api/search', { projectId, q: query, type: searchType, limit: '10' }))

  let results = data.results ?? []

  // For customers, filter by subtype (contact vs company)
  if (subtypeFilter) {
    results = results.filter((r) => r.subtype === subtypeFilter)
  }

  return results.map((r) => ({ value: r.id, label: r.name || 'Unnamed' }))
}
