'use client'

import { memo, useState, useRef, useCallback, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useRouter } from 'next/navigation'
import { Users, CircleAlert, MessageSquare, BookOpen, Layers, Minus, ChevronUp, Target, type LucideProps } from 'lucide-react'
import type { EntityGraphCategory, EntityGraphEntityNode } from '@/lib/db/queries/analytics'

// ---------------------------------------------------------------------------
// Icon + color + label maps
// ---------------------------------------------------------------------------

export const CATEGORY_ICONS: Record<EntityGraphCategory, React.ComponentType<LucideProps>> = {
  customer: Users,
  issue: CircleAlert,
  session: MessageSquare,
  knowledge_source: BookOpen,
  product_scope: Layers,
}

export const CATEGORY_COLORS: Record<EntityGraphCategory, string> = {
  customer: 'var(--accent-info)',
  issue: 'var(--accent-danger)',
  session: '#6b7280',
  knowledge_source: 'var(--accent-warning)',
  product_scope: '#a78bfa',
}

/** Hex colors for SVG gradients (CSS vars don't work in SVG gradient defs) */
export const HEX_COLORS: Record<string, string> = {
  customer: '#3b82f6',
  issue: '#ef4444',
  session: '#6b7280',
  knowledge_source: '#f59e0b',
  product_scope: '#a78bfa',
}

export const CATEGORY_LABELS: Record<EntityGraphCategory, string> = {
  customer: 'Customers',
  issue: 'Issues',
  session: 'Feedback',
  knowledge_source: 'Knowledge',
  product_scope: 'Scopes',
}

/** Build a detail URL for an individual entity */
function getEntityUrl(projectId: string, entityType: string, entityId: string): string | null {
  const base = `/projects/${projectId}`
  switch (entityType) {
    case 'company':
      return `${base}/customers/companies/${entityId}`
    case 'contact':
      return `${base}/customers/contacts/${entityId}`
    case 'issue':
      return `${base}/issues/${entityId}`
    case 'session':
      return `${base}/sessions/${entityId}`
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Node data types
// ---------------------------------------------------------------------------

export interface CategoryNodeData {
  category: EntityGraphCategory
  count: number
  recentEntities: EntityGraphEntityNode[]
  projectId: string
  [key: string]: unknown
}

export interface GroupNodeData {
  category: EntityGraphCategory
  groupId: string
  label: string
  count: number
  parentCategory: EntityGraphCategory
  onCollapse?: () => void
  [key: string]: unknown
}

export interface EntityNodeData {
  entityId: string
  label: string
  sublabel?: string
  category: EntityGraphCategory
  entityType: string
  [key: string]: unknown
}

export interface ClusterEntity {
  id: string
  label: string
  sublabel?: string
  entityType: string
  connections?: EntityGraphCategory[]
  goals?: Array<{ id: string; text: string }>
}

export interface ClusterGroupItem {
  id: string
  label: string
  count: number
  expanded?: boolean
  entities?: ClusterEntity[]
}

export interface ClusterNodeData {
  category: EntityGraphCategory
  groups: ClusterGroupItem[]
  projectId: string
  onCollapse?: () => void
  onGroupDrilldown?: (groupId: string) => void
  onGroupCollapse?: (groupId: string) => void
  [key: string]: unknown
}

// Invisible handles
const handleStyle: React.CSSProperties = { opacity: 0, width: 6, height: 6 }

// ---------------------------------------------------------------------------
// CategoryNode
// ---------------------------------------------------------------------------

function CategoryNodeComponent({ data }: NodeProps) {
  const { category, count, recentEntities } = data as unknown as CategoryNodeData
  const Icon = CATEGORY_ICONS[category]
  const color = CATEGORY_COLORS[category]

  const [isHovered, setIsHovered] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (hoverTimeout.current) clearTimeout(hoverTimeout.current) }
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setIsHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setIsHovered(false), 150)
  }, [])

  const showPreview = isHovered && recentEntities.length > 0

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, top: '50%' }} id="left-in" />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, top: '50%' }} id="right-out" />

      <div
        className="flex cursor-pointer items-center gap-1.5 rounded-md border bg-[color:var(--background)] px-2 py-1 transition-all duration-200"
        style={{
          borderColor: isHovered ? color : 'var(--border-subtle)',
          boxShadow: isHovered
            ? `0 2px 8px color-mix(in srgb, ${color} 15%, transparent)`
            : '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <div
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)` }}
        >
          <Icon className="h-3 w-3" style={{ color }} />
        </div>
        <div>
          <div className="font-mono text-[7px] uppercase tracking-wider text-[color:var(--text-secondary)]">
            {CATEGORY_LABELS[category]}
          </div>
          <div className="font-mono text-sm font-bold leading-tight text-[color:var(--foreground)]">
            {count}
          </div>
        </div>
      </div>

      {/* Hover preview card */}
      {showPreview && (
        <div
          className="absolute left-1/2 top-full z-50 mt-1.5 w-[190px] -translate-x-1/2 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-2"
          style={{ boxShadow: '0 3px 12px rgba(0,0,0,0.08)' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <ul className="flex flex-col gap-1">
            {recentEntities.map(entity => {
              const EntityIcon = CATEGORY_ICONS[entity.category]
              return (
                <li key={entity.id} className="flex items-center gap-1.5 overflow-hidden">
                  <EntityIcon className="h-2.5 w-2.5 shrink-0" style={{ color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[9px] text-[color:var(--foreground)]">
                      {entity.label}
                    </div>
                    {entity.sublabel && (
                      <div className="truncate font-mono text-[7px] text-[color:var(--text-secondary)]">
                        {entity.sublabel}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export const CategoryNode = memo(CategoryNodeComponent)

// ---------------------------------------------------------------------------
// GroupNode
// ---------------------------------------------------------------------------

function GroupNodeComponent({ data }: NodeProps) {
  const { category, label, count, onCollapse } = data as unknown as GroupNodeData
  const Icon = CATEGORY_ICONS[category]
  const color = CATEGORY_COLORS[category]

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, top: '50%' }} id="left-in" />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, top: '50%' }} id="right-out" />

      <div
        className="rounded-md border bg-[color:var(--background)] px-2 py-1"
        style={{ borderColor: `color-mix(in srgb, ${color} 30%, var(--border-subtle))` }}
      >
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 shrink-0" style={{ color }} />
          <div className="font-mono text-[9px] text-[color:var(--foreground)]">
            {label}
          </div>
          <div className="font-mono text-[9px] font-bold text-[color:var(--text-secondary)]">
            ({count})
          </div>
          {onCollapse && (
            <button
              className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded hover:bg-[color:var(--surface)]"
              onClick={(e) => { e.stopPropagation(); onCollapse() }}
              title="Collapse"
            >
              <Minus className="h-2 w-2 text-[color:var(--text-tertiary)]" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export const GroupNode = memo(GroupNodeComponent)

// ---------------------------------------------------------------------------
// EntityNode
// ---------------------------------------------------------------------------

function EntityNodeComponent({ data }: NodeProps) {
  const { label, sublabel, category } = data as unknown as EntityNodeData
  const color = CATEGORY_COLORS[category]
  const Icon = CATEGORY_ICONS[category]

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, top: '50%' }} id="left-in" />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, top: '50%' }} id="right-out" />

      <div
        className="flex items-center gap-1 rounded border bg-[color:var(--background)] px-1.5 py-0.5"
        style={{ borderColor: `color-mix(in srgb, ${color} 20%, var(--border-subtle))` }}
      >
        <Icon className="h-2.5 w-2.5 shrink-0" style={{ color }} />
        <div className="min-w-0">
          <div className="truncate font-mono text-[8px] text-[color:var(--foreground)]">{label}</div>
          {sublabel && (
            <div className="truncate font-mono text-[7px] text-[color:var(--text-secondary)]">{sublabel}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export const EntityNode = memo(EntityNodeComponent)

// ---------------------------------------------------------------------------
// ClusterNode - single compound node containing title + all sub-groups
// ---------------------------------------------------------------------------

function ClusterNodeComponent({ data }: NodeProps) {
  const { category, groups, projectId, onCollapse, onGroupDrilldown, onGroupCollapse } = data as unknown as ClusterNodeData
  const router = useRouter()
  const Icon = CATEGORY_ICONS[category]
  const color = CATEGORY_COLORS[category]
  const hasAnyExpanded = groups.some(g => g.expanded)

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, top: '50%' }} id="left-in" />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, top: '50%' }} id="right-out" />

      <div
        className="rounded-md border bg-[color:var(--background)]"
        style={{
          borderColor: `color-mix(in srgb, ${color} 25%, var(--border-subtle))`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          maxWidth: hasAnyExpanded ? 320 : undefined,
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-1.5 border-b px-2.5 py-1"
          style={{ borderColor: `color-mix(in srgb, ${color} 15%, var(--border-subtle))` }}
        >
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)` }}
          >
            <Icon className="h-3 w-3" style={{ color }} />
          </div>
          <div className="font-mono text-[7px] font-semibold uppercase tracking-wider" style={{ color }}>
            {CATEGORY_LABELS[category]}
          </div>
          {onCollapse && (
            <button
              className="ml-auto flex h-4 w-4 items-center justify-center rounded hover:bg-[color:var(--surface)]"
              onClick={(e) => { e.stopPropagation(); onCollapse() }}
              title="Collapse back"
            >
              <ChevronUp className="h-2.5 w-2.5 text-[color:var(--text-tertiary)]" />
            </button>
          )}
        </div>

        {/* Sub-groups (vertical when any is expanded, horizontal when all collapsed) */}
        <div className={`${hasAnyExpanded ? 'flex flex-col' : 'flex'} gap-1.5 p-1.5`}>
          {groups.map(group =>
            group.expanded && group.entities ? (
              /* ---- Expanded group: nested cluster ---- */
              <div
                key={group.id}
                className="rounded border"
                style={{ borderColor: `color-mix(in srgb, ${color} 20%, var(--border-subtle))` }}
              >
                <div
                  className="flex items-center gap-1 border-b px-2 py-0.5"
                  style={{ borderColor: `color-mix(in srgb, ${color} 10%, var(--border-subtle))` }}
                >
                  <Icon className="h-2.5 w-2.5 shrink-0" style={{ color }} />
                  <span className="font-mono text-[8px] font-semibold text-[color:var(--foreground)]">
                    {group.label}
                  </span>
                  <span className="font-mono text-[8px] text-[color:var(--text-secondary)]">
                    ({group.count})
                  </span>
                  <button
                    className="ml-auto flex h-3.5 w-3.5 items-center justify-center rounded hover:bg-[color:var(--surface)]"
                    onClick={(e) => { e.stopPropagation(); onGroupCollapse?.(group.id) }}
                    title="Collapse group"
                  >
                    <ChevronUp className="h-2 w-2 text-[color:var(--text-tertiary)]" />
                  </button>
                </div>
                <ul className="flex flex-col gap-0.5 p-1.5">
                  {group.entities.map(entity => {
                    const url = getEntityUrl(projectId, entity.entityType, entity.id)
                    return (
                      <li key={entity.id} className="flex flex-col">
                        <div
                          className={`flex items-center gap-1 overflow-hidden rounded px-1 py-px ${url ? 'cursor-pointer transition-colors hover:bg-[color:var(--surface)]' : ''}`}
                          onClick={url ? (e) => { e.stopPropagation(); router.push(url) } : undefined}
                        >
                          <Icon className="h-2 w-2 shrink-0" style={{ color, opacity: 0.6 }} />
                          <span className="truncate font-mono text-[8px] text-[color:var(--foreground)]">
                            {entity.label}
                          </span>
                          {entity.sublabel && (
                            <span className="truncate font-mono text-[7px] text-[color:var(--text-secondary)]">
                              {entity.sublabel}
                            </span>
                          )}
                          {entity.connections && entity.connections.length > 0 && (
                            <span className="ml-auto flex shrink-0 items-center gap-0.5">
                              {entity.connections
                                .filter(c => c !== category)
                                .map(c => (
                                  <span
                                    key={c}
                                    className="inline-block h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: CATEGORY_COLORS[c] }}
                                    title={CATEGORY_LABELS[c]}
                                  />
                                ))}
                            </span>
                          )}
                        </div>
                        {/* Goals sub-list for product scopes */}
                        {entity.goals && entity.goals.length > 0 && (
                          <ul className="ml-4 mt-0.5 flex flex-col gap-px border-l border-[color:var(--border-subtle)] pl-1.5">
                            {entity.goals.map(goal => (
                              <li key={goal.id} className="flex items-start gap-1 overflow-hidden">
                                <Target className="mt-px h-1.5 w-1.5 shrink-0 text-[color:var(--text-tertiary)]" />
                                <span className="font-mono text-[7px] leading-tight text-[color:var(--text-secondary)]">
                                  {goal.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              /* ---- Collapsed group: compact item ---- */
              <div
                key={group.id}
                className="flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 transition-colors hover:bg-[color:var(--surface)]"
                style={{ borderColor: `color-mix(in srgb, ${color} 20%, var(--border-subtle))` }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  onGroupDrilldown?.(group.id)
                }}
              >
                <Icon className="h-2.5 w-2.5 shrink-0" style={{ color }} />
                <span className="font-mono text-[9px] text-[color:var(--foreground)]">{group.label}</span>
                <span className="font-mono text-[9px] font-bold text-[color:var(--text-secondary)]">({group.count})</span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

export const ClusterNode = memo(ClusterNodeComponent)
