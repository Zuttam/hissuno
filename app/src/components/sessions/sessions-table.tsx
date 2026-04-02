'use client'

import { useMemo, useRef, useEffect } from 'react'
import { Badge, Checkbox } from '@/components/ui'
import { ResizableTable, useColumnStyle, type ColumnConfig } from '@/components/ui/resizable-table'
import type { SessionWithProject } from '@/types/session'
import { SESSION_SOURCE_INFO, type SessionSource, getSessionUserDisplay } from '@/types/session'
import type { ProductScopeRecord } from '@/types/product-scope'
import { SessionTagList } from './session-tags'

interface SessionsTableProps {
  sessions: SessionWithProject[]
  selectedSessionId: string | null
  onSelectSession: (session: SessionWithProject) => void
  onOpenMessages: (session: SessionWithProject) => void
  onArchive: (session: SessionWithProject) => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onToggleAll?: () => void
  isAllSelected?: boolean
  isIndeterminate?: boolean
  productScopes?: ProductScopeRecord[]
}

const STORAGE_KEY = 'sessions-table-column-widths'

function HeaderCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Checkbox ref={ref} checked={checked} onChange={onChange} />
    </div>
  )
}

export function SessionsTable({
  sessions,
  selectedSessionId,
  onSelectSession,
  onOpenMessages,
  onArchive,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  isAllSelected = false,
  isIndeterminate = false,
  productScopes = [],
}: SessionsTableProps) {
  const hasSelection = Boolean(selectedIds && onToggleSelect && onToggleAll)

  const scopeMap = useMemo(() => {
    const map = new Map<string, ProductScopeRecord>()
    for (const scope of productScopes) {
      map.set(scope.id, scope)
    }
    return map
  }, [productScopes])

  const columns: ColumnConfig[] = useMemo(
    () => [
      ...(hasSelection
        ? [
            {
              id: 'select',
              header: (
                <HeaderCheckbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={onToggleAll!}
                />
              ),
              defaultWidth: 36,
              minWidth: 36,
              maxWidth: 36,
            } as ColumnConfig,
          ]
        : []),
      { id: 'session', header: 'Feedback', defaultWidth: 140, minWidth: 80 },
      { id: 'customer', header: 'Customer', defaultWidth: 140, minWidth: 80 },
      { id: 'messages', header: 'Messages', defaultWidth: 90, minWidth: 70, align: 'center' },
      { id: 'tags', header: 'Tags', defaultWidth: 150, minWidth: 80 },
      { id: 'productScope', header: 'Scope', defaultWidth: 100, minWidth: 70 },
      { id: 'source', header: 'Source', defaultWidth: 90, minWidth: 70 },
      { id: 'status', header: 'Status', defaultWidth: 120, minWidth: 80 },
      { id: 'analyzed', header: 'Analyzed', defaultWidth: 80, minWidth: 60, align: 'center' },
      { id: 'issues', header: 'Issues', defaultWidth: 70, minWidth: 50, align: 'center' },
      { id: 'lastActivity', header: 'Last Activity', defaultWidth: 120, minWidth: 80 },
      { id: 'actions', header: <span className="sr-only">Actions</span>, defaultWidth: 80, minWidth: 60 },
    ],
    [hasSelection, isAllSelected, isIndeterminate, onToggleAll]
  )

  return (
    <ResizableTable columns={columns} storageKey={STORAGE_KEY}>
      {(columnWidths) =>
        sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            isSelected={selectedSessionId === session.id}
            onSelect={() => onSelectSession(session)}
            onOpenMessages={() => onOpenMessages(session)}
            onArchive={() => onArchive(session)}
            columnWidths={columnWidths}
            columns={columns}
            isChecked={selectedIds?.has(session.id) ?? false}
            onToggleCheck={onToggleSelect ? () => onToggleSelect(session.id) : undefined}
            scopeMap={scopeMap}
          />
        ))
      }
    </ResizableTable>
  )
}

interface SessionRowProps {
  session: SessionWithProject
  isSelected: boolean
  onSelect: () => void
  onOpenMessages: () => void
  onArchive: () => void
  columnWidths: Record<string, number>
  columns: ColumnConfig[]
  isChecked: boolean
  onToggleCheck?: () => void
  scopeMap: Map<string, ProductScopeRecord>
}

function SessionRow({
  session,
  isSelected,
  onSelect,
  onOpenMessages,
  onArchive,
  columnWidths,
  columns,
  isChecked,
  onToggleCheck,
  scopeMap,
}: SessionRowProps) {
  const truncatedId = session.id.length > 12 ? `${session.id.slice(0, 12)}...` : session.id
  const displayName = session.name || truncatedId
  const sourceInfo = SESSION_SOURCE_INFO[session.source as SessionSource] || {
    label: session.source,
    variant: 'default' as const,
  }
  const userDisplay = getSessionUserDisplay(session)
  const selectColumnStyle = useColumnStyle(columnWidths, 'select', columns)

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-[color:var(--border-subtle)] transition-colors ${
        isSelected
          ? 'bg-[color:var(--accent-primary)]/10'
          : 'hover:bg-[color:var(--surface-hover)]'
      } ${session.is_archived ? 'opacity-60' : ''}`}
    >
      {onToggleCheck && (
        <td
          className="px-3 py-2"
          style={selectColumnStyle}
          onClick={(e) => {
            e.stopPropagation()
            onToggleCheck()
          }}
        >
          <Checkbox checked={isChecked} onChange={onToggleCheck} />
        </td>
      )}
      <td className="px-3 py-2" style={useColumnStyle(columnWidths, 'session', columns)}>
        <div className="flex flex-col">
          <span className="text-[color:var(--foreground)]" title={session.name || session.id}>
            {displayName}
          </span>
          {session.name && (
            <span className="text-[10px] text-[color:var(--text-tertiary)]" title={session.id}>
              {truncatedId}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2" style={useColumnStyle(columnWidths, 'customer', columns)}>
        {userDisplay.name ? (
          <div className="flex flex-col">
            <span className="truncate text-[color:var(--foreground)]">{userDisplay.name}</span>
            {userDisplay.companyName && (
              <span className="truncate text-[10px] text-[color:var(--text-tertiary)]">
                {userDisplay.companyName}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[color:var(--text-tertiary)]">-</span>
        )}
      </td>
      <td
        className="px-3 py-2 text-center"
        style={useColumnStyle(columnWidths, 'messages', columns)}
      >
        <span className="text-[color:var(--foreground)]">{session.message_count}</span>
      </td>
      <td className="px-3 py-2" style={useColumnStyle(columnWidths, 'tags', columns)}>
        {session.tags && session.tags.length > 0 ? (
          <SessionTagList tags={session.tags} size="sm" emptyText="" />
        ) : (
          <span className="text-[color:var(--text-tertiary)]">-</span>
        )}
      </td>
      <td className="px-3 py-2" style={useColumnStyle(columnWidths, 'productScope', columns)}>
        {(() => {
          const scope = session.product_scope_id
            ? scopeMap.get(session.product_scope_id)
            : [...scopeMap.values()].find((a) => a.is_default)
          return scope ? (
            <Badge variant={scope.color}>{scope.name}</Badge>
          ) : (
            <span className="text-[color:var(--text-tertiary)]">-</span>
          )
        })()}
      </td>
      <td className="px-3 py-2" style={useColumnStyle(columnWidths, 'source', columns)}>
        <Badge variant={sourceInfo.variant}>{sourceInfo.label}</Badge>
      </td>
      <td className="px-3 py-2" style={useColumnStyle(columnWidths, 'status', columns)}>
        <span className="inline-flex items-center gap-1">
          {session.is_human_takeover && <Badge variant="warning">Needs Human</Badge>}
          <Badge variant={session.status === 'active' ? 'success' : 'default'}>
            {session.status}
          </Badge>
          {session.is_archived && <Badge variant="default">Archived</Badge>}
        </span>
      </td>
      <td
        className="px-3 py-2 text-center"
        style={useColumnStyle(columnWidths, 'analyzed', columns)}
      >
        {session.base_processed_at != null ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="inline-block text-[color:var(--accent-success)]"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span className="text-[color:var(--text-tertiary)]">-</span>
        )}
      </td>
      <td
        className="px-3 py-2 text-center"
        style={useColumnStyle(columnWidths, 'issues', columns)}
      >
        <span className="text-[color:var(--foreground)]">
          {session.linked_issue_count ?? 0}
        </span>
      </td>
      <td className="px-3 py-2" style={useColumnStyle(columnWidths, 'lastActivity', columns)}>
        <span className="text-[color:var(--text-secondary)]">
          {formatRelativeTime(session.last_activity_at)}
        </span>
      </td>
      <td className="px-3 py-2" style={useColumnStyle(columnWidths, 'actions', columns)}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenMessages()
            }}
            className="rounded-[4px] p-1.5 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-primary)]"
            aria-label="View messages"
            title="View messages"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onArchive()
            }}
            className="rounded-[4px] p-1.5 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-primary)]"
            aria-label={session.is_archived ? 'Unarchive feedback' : 'Archive feedback'}
            title={session.is_archived ? 'Unarchive' : 'Archive'}
          >
            {session.is_archived ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="5" rx="2" />
                <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
                <path d="M12 13v4" />
                <path d="m9 16 3 3 3-3" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="5" rx="2" />
                <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
                <path d="M10 13h4" />
              </svg>
            )}
          </button>
        </div>
      </td>
    </tr>
  )
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return 'Just now'
  } else if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}
