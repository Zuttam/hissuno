'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useEntityRelationships } from '@/hooks/use-entity-relationships'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Combobox, type ComboboxItem } from '@/components/ui/combobox'
import { Spinner } from '@/components/ui/spinner'
import type { EntityType } from '@/lib/db/queries/types'
import type { RelatedEntitiesResult, RelationshipInfo } from '@/lib/db/queries/entity-relationships'
import { formatRelativeTime } from '@/lib/utils/format-time'
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
  title?: string
  emptyText?: string
}

export function RelatedEntitiesSection({
  projectId,
  entityType,
  entityId,
  allowedTypes,
  title,
  emptyText,
}: RelatedEntitiesSectionProps) {
  const { relationships, isLoading, link, unlink } = useEntityRelationships({
    projectId,
    entityType,
    entityId,
  })

  const hasCustomers = allowedTypes.includes('company') || allowedTypes.includes('contact')
  const nonCustomerTypes = allowedTypes.filter((t) => t !== 'company' && t !== 'contact')

  const totalCount = useMemo(() => {
    let count = 0
    if (hasCustomers) {
      count += relationships.companies.length + relationships.contacts.length
    }
    for (const t of nonCustomerTypes) {
      count += getGroupItems(relationships, t).length
    }
    return count
  }, [relationships, hasCustomers, nonCustomerTypes])

  const headingBase = title ?? 'Related'
  return (
    <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
      <CollapsibleSection
        title={`${headingBase}${!isLoading ? ` (${totalCount})` : ''}`}
        variant="flat"
        defaultExpanded={totalCount > 0}
      >
        {isLoading ? (
          <div className="flex justify-center py-2"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-3">
            {hasCustomers && (
              <CustomersGroup
                projectId={projectId}
                companies={relationships.companies}
                contacts={relationships.contacts}
                allowCompanies={allowedTypes.includes('company')}
                allowContacts={allowedTypes.includes('contact')}
                onLink={link}
                onUnlink={unlink}
              />
            )}
            {nonCustomerTypes.map((t) => (
              <RelatedGroup
                key={t}
                projectId={projectId}
                relatedType={t}
                items={getGroupItems(relationships, t)}
                onLink={link}
                onUnlink={unlink}
              />
            ))}
            {totalCount === 0 && allowedTypes.length > 0 && (
              <p className="text-sm text-[color:var(--text-secondary)]">{emptyText ?? 'No related entities yet'}</p>
            )}
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Customers group (companies -> contacts hierarchy)
// ---------------------------------------------------------------------------

interface CustomersGroupProps {
  projectId: string
  companies: RelatedEntitiesResult['companies']
  contacts: RelatedEntitiesResult['contacts']
  allowCompanies: boolean
  allowContacts: boolean
  onLink: (targetType: EntityType, targetId: string) => Promise<boolean>
  onUnlink: (targetType: EntityType, targetId: string) => Promise<boolean>
}

type CustomerLinkType = 'company' | 'contact'

function CustomersGroup({
  projectId,
  companies,
  contacts,
  allowCompanies,
  allowContacts,
  onLink,
  onUnlink,
}: CustomersGroupProps) {
  const [showSearch, setShowSearch] = useState(false)
  const [searchType, setSearchType] = useState<CustomerLinkType>('company')

  // Build hierarchy: companies with nested contacts, plus standalone contacts
  const { companyMap, standaloneContacts } = useMemo(() => {
    const map = new Map<string, {
      company: RelatedEntitiesResult['companies'][number]
      contacts: RelatedEntitiesResult['contacts']
    }>()
    for (const c of companies) {
      map.set(c.id, { company: c, contacts: [] })
    }
    const standalone: RelatedEntitiesResult['contacts'] = []
    for (const contact of contacts) {
      if (contact.company_id && map.has(contact.company_id)) {
        map.get(contact.company_id)!.contacts.push(contact)
      } else {
        standalone.push(contact)
      }
    }
    return { companyMap: map, standaloneContacts: standalone }
  }, [companies, contacts])

  const totalCustomers = companies.length + contacts.length

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          Customers{totalCustomers > 0 ? ` (${totalCustomers})` : ''}
        </span>
        <div className="flex items-center gap-2">
          {showSearch && allowCompanies && allowContacts && (
            <div className="flex items-center gap-0.5 rounded bg-[color:var(--surface-secondary)] p-0.5">
              <button
                type="button"
                onClick={() => setSearchType('company')}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition ${
                  searchType === 'company'
                    ? 'bg-[color:var(--surface-primary)] text-[color:var(--foreground)]'
                    : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]'
                }`}
              >
                Company
              </button>
              <button
                type="button"
                onClick={() => setSearchType('contact')}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition ${
                  searchType === 'contact'
                    ? 'bg-[color:var(--surface-primary)] text-[color:var(--foreground)]'
                    : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]'
                }`}
              >
                Contact
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="font-mono text-[10px] text-[color:var(--accent-primary)] hover:underline"
          >
            {showSearch ? 'Cancel' : '+ Link'}
          </button>
        </div>
      </div>

      {showSearch && (
        <LinkSearch
          projectId={projectId}
          relatedType={searchType}
          existingIds={[
            ...companies.map((c) => c.id),
            ...contacts.map((c) => c.id),
          ]}
          onSelect={async (id) => {
            await onLink(searchType, id)
            setShowSearch(false)
          }}
        />
      )}

      {/* Companies with nested contacts */}
      {companies.map((company) => {
        const companyContacts = companyMap.get(company.id)?.contacts ?? []
        return (
          <div key={company.id} className="flex flex-col">
            <CustomerItem
              projectId={projectId}
              type="company"
              id={company.id}
              label={company.name}
              sublabel={company.domain}
              linkedAt={company.linkedAt}
              context={(company.metadata as Record<string, unknown> | null)?.context as string | undefined ?? null}
              onUnlink={() => onUnlink('company', company.id)}
            />
            {companyContacts.map((contact) => (
              <div key={contact.id} className="pl-4">
                <CustomerItem
                  projectId={projectId}
                  type="contact"
                  id={contact.id}
                  label={contact.name}
                  sublabel={contact.email}
                  linkedAt={contact.linkedAt}
                  context={(contact.metadata as Record<string, unknown> | null)?.context as string | undefined ?? null}
                  onUnlink={() => onUnlink('contact', contact.id)}
                />
              </div>
            ))}
          </div>
        )
      })}

      {/* Standalone contacts (no company or company not in related list) */}
      {standaloneContacts.map((contact) => (
        <CustomerItem
          key={contact.id}
          projectId={projectId}
          type="contact"
          id={contact.id}
          label={contact.name}
          sublabel={contact.email}
          linkedAt={contact.linkedAt}
          context={(contact.metadata as Record<string, unknown> | null)?.context as string | undefined ?? null}
          onUnlink={() => onUnlink('contact', contact.id)}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Customer item (shared between company and contact rendering)
// ---------------------------------------------------------------------------

interface CustomerItemProps {
  projectId: string
  type: 'company' | 'contact'
  id: string
  label: string
  sublabel?: string
  linkedAt?: string | null
  context?: string | null
  onUnlink: () => void
}

function CustomerItem({ projectId, type, id, label, sublabel, linkedAt, context, onUnlink }: CustomerItemProps) {
  return (
    <div className="group flex flex-col gap-0.5 rounded-[4px] px-1 py-1 text-sm transition hover:bg-[color:var(--surface-hover)]">
      <div className="flex items-center gap-2">
        <Link
          href={entityLink(projectId, type, id)}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <span className="shrink-0 text-[10px] text-[color:var(--text-tertiary)]">
            {type === 'company' ? 'CO' : 'CT'}
          </span>
          <span className="min-w-0 flex-1 truncate text-[color:var(--foreground)]">
            {label}
          </span>
          {sublabel && (
            <span className="shrink-0 text-xs text-[color:var(--text-tertiary)]">
              {sublabel}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onUnlink}
          className="shrink-0 text-[color:var(--text-tertiary)] opacity-0 transition hover:text-[color:var(--accent-danger)] group-hover:opacity-100"
          title="Unlink"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {linkedAt && (
        <span className="pl-1 text-[10px] text-[color:var(--text-tertiary)]">
          {formatRelativeTime(linkedAt)}
        </span>
      )}
      {context && (
        <p className="pl-1 text-xs leading-snug text-[color:var(--text-secondary)]">
          {context}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-type group (non-customer types)
// ---------------------------------------------------------------------------

interface GroupItem {
  id: string
  label: string
  sublabel?: string
  context?: string | null
  linkedAt?: string | null
}

function extractRelInfo(entity: RelationshipInfo): Pick<GroupItem, 'context' | 'linkedAt'> {
  return {
    context: (entity.metadata as Record<string, unknown> | null)?.context as string | undefined ?? null,
    linkedAt: entity.linkedAt ?? null,
  }
}

function getGroupItems(
  relationships: RelatedEntitiesResult,
  type: EntityType,
): GroupItem[] {
  switch (type) {
    case 'company':
      return relationships.companies.map((c) => ({ id: c.id, label: c.name, sublabel: c.domain, ...extractRelInfo(c) }))
    case 'contact':
      return relationships.contacts.map((c) => ({ id: c.id, label: c.name, sublabel: c.email, ...extractRelInfo(c) }))
    case 'issue':
      return relationships.issues.map((i) => ({ id: i.id, label: i.name, sublabel: i.status ?? undefined, ...extractRelInfo(i) }))
    case 'session':
      return relationships.sessions.map((s) => ({ id: s.id, label: s.name || 'Unnamed', sublabel: s.source ?? undefined, ...extractRelInfo(s) }))
    case 'knowledge_source':
      return relationships.knowledgeSources.map((k) => ({ id: k.id, label: k.name || 'Unnamed', sublabel: k.type, ...extractRelInfo(k) }))
    case 'product_scope':
      return relationships.productScopes.map((p) => ({ id: p.id, label: p.name, ...extractRelInfo(p) }))
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
      return `/projects/${projectId}/products`
    case 'product_scope':
      return `/projects/${projectId}/products?area=${id}`
  }
}

interface RelatedGroupProps {
  projectId: string
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
          className="group flex flex-col gap-0.5 rounded-[4px] px-1 py-1 text-sm transition hover:bg-[color:var(--surface-hover)]"
        >
          <div className="flex items-center gap-2">
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
          {item.linkedAt && (
            <span className="pl-1 text-[10px] text-[color:var(--text-tertiary)]">
              {formatRelativeTime(item.linkedAt)}
            </span>
          )}
          {item.context && (
            <p className="pl-1 text-xs leading-snug text-[color:var(--text-secondary)]">
              {item.context}
            </p>
          )}
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
