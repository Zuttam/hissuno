'use client'

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react'

/**
 * Column configuration for resizable tables
 */
export interface ColumnConfig {
  id: string
  header: ReactNode
  minWidth?: number // default 50px
  maxWidth?: number // default 500px
  defaultWidth?: number
  align?: 'left' | 'center' | 'right'
}

interface ResizableTableProps {
  columns: ColumnConfig[]
  storageKey: string
  children: (columnWidths: Record<string, number>) => ReactNode
  className?: string
}

const DEFAULT_MIN_WIDTH = 50
const DEFAULT_MAX_WIDTH = 500
const DEFAULT_WIDTH = 120

/**
 * Resizable table component with draggable column borders
 * and localStorage persistence
 */
export function ResizableTable({
  columns,
  storageKey,
  children,
  className = '',
}: ResizableTableProps) {
  // Initialize column widths from localStorage or defaults
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') {
      return getDefaultWidths(columns)
    }
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>
        // Merge with defaults for any new columns
        const defaults = getDefaultWidths(columns)
        return { ...defaults, ...parsed }
      }
    } catch {
      // Ignore localStorage errors
    }
    return getDefaultWidths(columns)
  })

  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(0)

  // Persist widths to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(columnWidths))
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [columnWidths, storageKey])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, columnId: string) => {
      e.preventDefault()
      setResizingColumn(columnId)
      startXRef.current = e.clientX
      startWidthRef.current = columnWidths[columnId] || DEFAULT_WIDTH
    },
    [columnWidths]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizingColumn) return

      const column = columns.find((c) => c.id === resizingColumn)
      if (!column) return

      const diff = e.clientX - startXRef.current
      const newWidth = startWidthRef.current + diff
      const minWidth = column.minWidth ?? DEFAULT_MIN_WIDTH
      const maxWidth = column.maxWidth ?? DEFAULT_MAX_WIDTH

      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))

      setColumnWidths((prev) => ({
        ...prev,
        [resizingColumn]: clampedWidth,
      }))
    },
    [resizingColumn, columns]
  )

  const handleMouseUp = useCallback(() => {
    setResizingColumn(null)
  }, [])

  // Global mouse events for dragging
  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingColumn, handleMouseMove, handleMouseUp])

  return (
    <div
      className={`overflow-hidden rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-sm" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="border-b border-[color:var(--border-subtle)]">
              {columns.map((column, index) => {
                const width = columnWidths[column.id] || column.defaultWidth || DEFAULT_WIDTH
                const isLast = index === columns.length - 1
                const align = column.align || 'left'
                const textAlign =
                  align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'

                return (
                  <th
                    key={column.id}
                    className={`relative px-3 py-2 ${textAlign} text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]`}
                    style={{ width: isLast ? 'auto' : width }}
                  >
                    {column.header}
                    {!isLast && (
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[color:var(--accent-primary)]/30"
                        onMouseDown={(e) => handleMouseDown(e, column.id)}
                        style={{
                          backgroundColor:
                            resizingColumn === column.id
                              ? 'var(--accent-primary)'
                              : 'transparent',
                        }}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>{children(columnWidths)}</tbody>
        </table>
      </div>
    </div>
  )
}

function getDefaultWidths(columns: ColumnConfig[]): Record<string, number> {
  const widths: Record<string, number> = {}
  for (const column of columns) {
    widths[column.id] = column.defaultWidth || DEFAULT_WIDTH
  }
  return widths
}

/**
 * Helper hook to get column style for table cells
 */
export function useColumnStyle(
  columnWidths: Record<string, number>,
  columnId: string,
  columns: ColumnConfig[]
): React.CSSProperties {
  const isLast = columns[columns.length - 1]?.id === columnId
  const column = columns.find((c) => c.id === columnId)
  const width = columnWidths[columnId] || column?.defaultWidth || DEFAULT_WIDTH

  return {
    width: isLast ? 'auto' : width,
    maxWidth: isLast ? 'none' : width,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
}
