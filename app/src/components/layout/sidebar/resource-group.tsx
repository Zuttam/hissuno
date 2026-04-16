'use client'

import Link from 'next/link'
import type { ResourceGroupItem } from './resource-tree-types'
import { ResourceItem } from './resource-item'

function ResourceTreeItems({
  items,
  allItems,
  selectedItemId,
  onItemClick,
  depth,
}: {
  items: ResourceGroupItem[]
  allItems: ResourceGroupItem[]
  selectedItemId: string | null
  onItemClick: (item: ResourceGroupItem) => void
  depth: number
}) {
  return (
    <>
      {items.map((item) => {
        const children = allItems.filter(child => child.parentId === item.id)
        return (
          <div key={item.id}>
            <div style={{ paddingLeft: depth * 12 }}>
              <ResourceItem
                name={item.name}
                subtitle={item.subtitle}
                isSelected={selectedItemId === item.id}
                onClick={() => onItemClick(item)}
              />
            </div>
            {children.length > 0 && (
              <ResourceTreeItems
                items={children}
                allItems={allItems}
                selectedItemId={selectedItemId}
                onItemClick={onItemClick}
                depth={depth + 1}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      className={`${className} transition-transform ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
    </svg>
  )
}

interface ResourceGroupProps {
  label: string
  isExpanded: boolean
  onToggle: () => void
  items: ResourceGroupItem[]
  total: number
  isLoading: boolean
  selectedItemId: string | null
  onItemClick: (item: ResourceGroupItem) => void
  pageHref: string
  projectId: string
}

export function ResourceGroup({
  label,
  isExpanded,
  onToggle,
  items,
  total,
  isLoading,
  selectedItemId,
  onItemClick,
  pageHref,
  projectId,
}: ResourceGroupProps) {
  const resolvedHref = pageHref.replace('[id]', projectId)

  return (
    <div>
      <div className="flex w-full items-center gap-1 px-2 py-1 transition hover:bg-[color:var(--surface-hover)] rounded-[4px]">
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 p-0.5 -m-0.5 rounded-[2px] hover:bg-[color:var(--surface-hover)]"
        >
          <ChevronIcon className="h-3 w-3 text-[color:var(--text-tertiary)]" expanded={isExpanded} />
        </button>
        <Link
          href={resolvedHref}
          className="flex flex-1 items-center gap-1 min-w-0"
        >
          <span className="flex-1 truncate text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-secondary)]">
            {label}
          </span>
          {total > 0 && (
            <span className="text-[9px] tabular-nums text-[color:var(--text-tertiary)]">
              {total}
            </span>
          )}
        </Link>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-0.5 pl-3 pt-0.5">
          {isLoading && items.length === 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <div className="h-3 w-3 animate-spin rounded-full border border-[color:var(--text-tertiary)] border-t-transparent" />
              <span className="text-[10px] text-[color:var(--text-tertiary)]">Loading...</span>
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <span className="px-2 py-1 text-[10px] text-[color:var(--text-tertiary)]">No items yet</span>
          )}

          <ResourceTreeItems
            items={items.filter(item => !item.parentId)}
            allItems={items}
            selectedItemId={selectedItemId}
            onItemClick={onItemClick}
            depth={0}
          />

          {total > items.length && (
            <Link
              href={resolvedHref}
              className="px-2 py-1 text-[10px] text-[color:var(--accent-primary)] hover:underline"
            >
              View all {total}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
