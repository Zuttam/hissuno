'use client'

import type { GraphCategory } from './types'
import { CATEGORY_HEX, CATEGORY_LABELS } from './types'

const CATEGORIES: GraphCategory[] = ['customer', 'issue', 'session', 'knowledge_source', 'product_scope']

interface GraphToolbarProps {
  includeOrphans: boolean
  onToggleOrphans: (value: boolean) => void
  hiddenCategories: Set<GraphCategory>
  onToggleCategory: (cat: GraphCategory) => void
}

export function GraphToolbar({ includeOrphans, onToggleOrphans, hiddenCategories, onToggleCategory }: GraphToolbarProps) {
  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)]/90 backdrop-blur-sm px-3 py-2">
      {CATEGORIES.map((cat) => {
        const hidden = hiddenCategories.has(cat)
        return (
          <button
            key={cat}
            type="button"
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onToggleCategory(cat)}
          >
            <div
              className="h-2.5 w-2.5 rounded-full flex-shrink-0 transition-opacity"
              style={{
                backgroundColor: CATEGORY_HEX[cat],
                opacity: hidden ? 0.2 : 1,
              }}
            />
            <span
              className="font-mono text-[10px] text-[color:var(--text-secondary)] transition-opacity"
              style={{ opacity: hidden ? 0.4 : 1 }}
            >
              {CATEGORY_LABELS[cat]}
            </span>
          </button>
        )
      })}
      <label className="flex items-center gap-2 border-t border-[color:var(--border-subtle)] pt-1.5 mt-0.5 cursor-pointer">
        <div
          className="flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-[2px] border"
          style={{
            borderColor: includeOrphans ? 'var(--accent-selected)' : 'var(--border-subtle)',
            backgroundColor: includeOrphans ? 'var(--accent-selected)' : 'transparent',
          }}
        >
          {includeOrphans && (
            <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <input
          type="checkbox"
          checked={includeOrphans}
          onChange={(e) => onToggleOrphans(e.target.checked)}
          className="sr-only"
        />
        <span className="font-mono text-[10px] text-[color:var(--text-secondary)]">
          Show unlinked
        </span>
      </label>
    </div>
  )
}
