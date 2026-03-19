'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils/class'

export interface BatchAction {
  label: string
  icon: ReactNode
  onClick?: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
  dropdown?: { label: string; onClick: () => void }[]
}

interface BatchActionBarProps {
  selectedCount: number
  totalCount: number
  actions: BatchAction[]
  onSelectAll: () => void
  onClearSelection: () => void
  isAllSelected: boolean
  progressSlot?: ReactNode
  className?: string
}

export function BatchActionBar({
  selectedCount,
  totalCount,
  actions,
  onSelectAll,
  onClearSelection,
  isAllSelected,
  progressSlot,
  className,
}: BatchActionBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openDropdown) return

    function handlePointerDown(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openDropdown])

  // Close dropdown when selection changes
  useEffect(() => {
    setOpenDropdown(null)
  }, [selectedCount])

  const btnClass = (action: BatchAction) =>
    `inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 font-mono text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
      action.variant === 'danger'
        ? 'text-[color:var(--accent-danger)] hover:bg-[color:var(--accent-danger)]/10'
        : 'text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]'
    }`

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          className={cn(
            'z-20 flex items-center gap-3 rounded-t-[4px] border border-[color:var(--accent-selected)]/30 bg-[color:var(--background)] px-3 py-1.5 shadow-sm',
            className,
          )}
        >
          <span className="shrink-0 font-mono text-xs font-bold text-[color:var(--foreground)]">
            {selectedCount}
          </span>

          {!isAllSelected && (
            <button
              type="button"
              onClick={onSelectAll}
              className="shrink-0 text-xs text-[color:var(--accent-selected)] hover:underline"
            >
              All {totalCount}
            </button>
          )}

          <button
            type="button"
            onClick={onClearSelection}
            className="shrink-0 text-xs text-[color:var(--text-tertiary)] hover:text-[color:var(--foreground)]"
          >
            Clear
          </button>

          <div className="mx-1 h-4 w-px bg-[color:var(--border-subtle)]" />

          {progressSlot || (
            <div className="flex items-center gap-1" ref={dropdownRef}>
              {actions.map((action) =>
                action.dropdown ? (
                  <div key={action.label} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === action.label ? null : action.label)}
                      disabled={action.disabled}
                      className={btnClass(action)}
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
                        {action.icon}
                      </span>
                      {action.label}
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5 opacity-50">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {openDropdown === action.label && (
                      <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] py-1 shadow-lg">
                        {action.dropdown.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              setOpenDropdown(null)
                              item.onClick()
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-hover)]"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={btnClass(action)}
                  >
                    <span className="inline-flex h-4 w-4 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
                      {action.icon}
                    </span>
                    {action.label}
                  </button>
                )
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
