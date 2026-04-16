'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { ChevronRight, Folder, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { KnowledgeSourceWithCodebase, KnowledgeSourceType } from '@/lib/knowledge/types'
import { getSourceDisplayValue } from '@/lib/knowledge/types'
import type { ProductScopeRecord } from '@/types/product-scope'

const SOURCE_TYPE_ICON: Record<KnowledgeSourceType, React.ReactNode> = {
  codebase: <Image src="/logos/github.svg" alt="GitHub" width={14} height={14} />,
  website: <span className="text-xs">🌐</span>,
  docs_portal: <span className="text-xs">📚</span>,
  uploaded_doc: <span className="text-xs">📄</span>,
  raw_text: <span className="text-xs">📝</span>,
  notion: <Image src="/logos/notion.svg" alt="Notion" width={14} height={14} className="dark:invert" />,
  folder: null, // Folder uses Lucide icon below
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  done: { color: 'var(--accent-success)', label: 'Analyzed' },
  analyzing: { color: 'var(--accent-warning)', label: 'Analyzing' },
  failed: { color: 'var(--accent-danger)', label: 'Failed' },
  pending: { color: 'var(--text-tertiary)', label: 'Pending' },
}

interface KnowledgeTreeNodeProps {
  source: KnowledgeSourceWithCodebase
  depth: number
  childrenMap: Map<string | null, KnowledgeSourceWithCodebase[]>
  descendantCounts: Map<string, number>
  expandedIds: Set<string>
  selectedSourceId: string | null
  onSelect: (sourceId: string) => void
  onToggleExpand: (id: string) => void
  onUpdate: (sourceId: string, updates: Record<string, unknown>) => Promise<boolean>
  onDelete: (sourceId: string, options?: { children?: 'reparent' | 'delete' }) => Promise<boolean>
  onCreateFolder: (parentId?: string | null) => void
  onDrop: (draggedId: string, targetId: string | null, position: 'inside' | 'before' | 'after') => Promise<void>
  getAncestorIds: (sourceId: string) => string[]
  productScopes?: ProductScopeRecord[]
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

export function KnowledgeTreeNode({
  source,
  depth,
  childrenMap,
  descendantCounts,
  expandedIds,
  selectedSourceId,
  onSelect,
  onToggleExpand,
  onUpdate,
  onDelete,
  onCreateFolder,
  onDrop,
  getAncestorIds,
  productScopes,
}: KnowledgeTreeNodeProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'inside' | 'after' | null>(null)
  const nodeRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const children = childrenMap.get(source.id) ?? []
  const hasChildren = children.length > 0
  const isFolder = source.type === 'folder'
  const isExpandable = isFolder || hasChildren
  const isExpanded = expandedIds.has(source.id)
  const isSelected = source.id === selectedSourceId
  const statusConfig = STATUS_CONFIG[source.status] ?? STATUS_CONFIG.pending
  const descendantCount = descendantCounts.get(source.id) ?? 0
  const scopeName = productScopes?.find(a => a.id === source.product_scope_id)?.name

  const handleRenameStart = useCallback(() => {
    setRenameValue(source.name ?? '')
    setIsRenaming(true)
    setContextMenu(null)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }, [source.name])

  const handleRenameCommit = useCallback(async () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== source.name) {
      await onUpdate(source.id, { name: trimmed })
    }
    setIsRenaming(false)
  }, [renameValue, source.id, source.name, onUpdate])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', source.id)
    e.dataTransfer.effectAllowed = 'move'
  }, [source.id])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const draggedId = e.dataTransfer.types.includes('text/plain') ? 'pending' : null
    if (!draggedId) return

    const rect = nodeRef.current?.getBoundingClientRect()
    if (!rect) return

    const y = e.clientY - rect.top
    const threshold = rect.height * 0.25

    if (isExpandable && y > threshold && y < rect.height - threshold) {
      setDropPosition('inside')
    } else if (y <= threshold) {
      setDropPosition('before')
    } else {
      setDropPosition('after')
    }
  }, [isExpandable])

  const handleDragLeave = useCallback(() => {
    setDropPosition(null)
  }, [])

  const handleDropEvent = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const draggedId = e.dataTransfer.getData('text/plain')
    setDropPosition(null)

    if (!draggedId || draggedId === source.id) return

    // Prevent dropping into own descendants
    const ancestors = getAncestorIds(source.id)
    if (ancestors.includes(draggedId)) return

    await onDrop(draggedId, source.id, dropPosition ?? 'inside')
  }, [source.id, dropPosition, onDrop, getAncestorIds])

  return (
    <>
      <div
        ref={nodeRef}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropEvent}
        onContextMenu={handleContextMenu}
        className="relative"
        style={{ paddingLeft: depth * 20 }}
      >
        {/* Drop indicators */}
        {dropPosition === 'before' && (
          <div
            className="absolute left-0 right-0 top-0 h-0.5 bg-[color:var(--accent-selected)]"
            style={{ marginLeft: depth * 20 }}
          />
        )}
        {dropPosition === 'after' && (
          <div
            className="absolute left-0 right-0 bottom-0 h-0.5 bg-[color:var(--accent-selected)]"
            style={{ marginLeft: depth * 20 }}
          />
        )}

        <button
          type="button"
          onClick={() => {
            if (isExpandable) onToggleExpand(source.id)
            onSelect(source.id)
          }}
          onDoubleClick={handleRenameStart}
          className={`flex w-full items-center gap-1.5 rounded-[4px] px-1.5 py-1 text-left transition ${
            isSelected
              ? 'bg-[color:var(--accent-selected)]/10 border border-[color:var(--accent-selected)]/30'
              : 'hover:bg-[color:var(--surface-hover)] border border-transparent'
          } ${dropPosition === 'inside' ? 'ring-1 ring-[color:var(--accent-selected)]' : ''}`}
        >
          {/* Expand/collapse chevron */}
          {isExpandable ? (
            <ChevronRight
              size={12}
              className={`shrink-0 text-[color:var(--text-tertiary)] transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          ) : (
            <span className="w-3 shrink-0" />
          )}

          {/* Icon */}
          {isFolder ? (
            <Folder size={14} className="shrink-0 text-[color:var(--text-secondary)]" />
          ) : (
            <span className="flex shrink-0 items-center">
              {SOURCE_TYPE_ICON[source.type] ?? null}
            </span>
          )}

          {/* Name / Rename input */}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={handleRenameCommit}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleRenameCommit()
                if (e.key === 'Escape') setIsRenaming(false)
              }}
              onClick={e => e.stopPropagation()}
              className="flex-1 bg-transparent text-sm text-[color:var(--foreground)] outline-none border-b border-[color:var(--accent-selected)]"
              autoFocus
            />
          ) : (
            <span className="flex-1 truncate text-sm text-[color:var(--foreground)]">
              {getSourceName(source)}
            </span>
          )}

          {/* Descendant count for folders */}
          {isFolder && descendantCount > 0 && (
            <span className="shrink-0 text-[10px] text-[color:var(--text-tertiary)]">
              {descendantCount}
            </span>
          )}

          {/* Status dot (non-folders only) */}
          {!isFolder && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: statusConfig.color }}
              title={statusConfig.label}
            />
          )}

          {/* Product scope badge */}
          {scopeName && (
            <Badge variant="info" className="text-[10px] shrink-0">{scopeName}</Badge>
          )}
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 min-w-[160px] rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              onClick={handleRenameStart}
              className="flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-xs text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]"
            >
              <Pencil size={12} /> Rename
            </button>
            {isFolder && (
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null)
                  onCreateFolder(source.id)
                }}
                className="flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-xs text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]"
              >
                <FolderPlus size={12} /> New subfolder
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setContextMenu(null)
                void onDelete(source.id, hasChildren ? undefined : undefined)
              }}
              className="flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-xs text-[color:var(--accent-danger)] hover:bg-[color:var(--surface-hover)]"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      )}

      {/* Children */}
      {isExpanded && children.map(child => (
        <KnowledgeTreeNode
          key={child.id}
          source={child}
          depth={depth + 1}
          childrenMap={childrenMap}
          descendantCounts={descendantCounts}
          expandedIds={expandedIds}
          selectedSourceId={selectedSourceId}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onCreateFolder={onCreateFolder}
          onDrop={onDrop}
          getAncestorIds={getAncestorIds}
          productScopes={productScopes}
        />
      ))}
    </>
  )
}
