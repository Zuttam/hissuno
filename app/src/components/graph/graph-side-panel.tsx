'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  BookOpen,
  CircleAlert,
  ExternalLink,
  Layers,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'

import { linkEntities, unlinkEntities } from '@/lib/api/relationships'
import type { EntityType } from '@/lib/db/queries/types'

import type { GraphCategory, SimulationEdge, SimulationNode } from './types'
import { CATEGORY_HEX, CATEGORY_LABELS, entityTypeToCategory } from './types'

interface GraphSidePanelProps {
  node: SimulationNode
  edges: SimulationEdge[]
  allNodes: SimulationNode[]
  projectId: string
  onClose: () => void
  onNavigateToNode: (nodeId: string) => void
  onRefresh: () => Promise<void>
}

const CATEGORY_ICONS: Record<GraphCategory, React.ComponentType<{ className?: string }>> = {
  customer: Users,
  issue: CircleAlert,
  session: MessageSquare,
  knowledge_source: BookOpen,
  product_scope: Layers,
}

function getEntityDetailUrl(
  projectId: string,
  entityType: EntityType,
  entityId: string,
): string | null {
  switch (entityType) {
    case 'company':
      return `/projects/${projectId}/customers/companies/${entityId}`
    case 'contact':
      return `/projects/${projectId}/customers/contacts/${entityId}`
    case 'issue':
      return `/projects/${projectId}/issues/${entityId}`
    case 'session':
      return `/projects/${projectId}/sessions/${entityId}`
    default:
      return null
  }
}

function resolveEdgeNodeId(ref: SimulationNode | string): string {
  return typeof ref === 'string' ? ref : ref.id
}

export function GraphSidePanel({
  node,
  edges,
  allNodes,
  projectId,
  onClose,
  onNavigateToNode,
  onRefresh,
}: GraphSidePanelProps) {
  const [isAddingConnection, setIsAddingConnection] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [removingEdgeId, setRemovingEdgeId] = useState<string | null>(null)
  const [addingNodeId, setAddingNodeId] = useState<string | null>(null)

  const Icon = CATEGORY_ICONS[node.category]
  const categoryColor = CATEGORY_HEX[node.category]

  // Get connected edges and nodes
  const connectedEdges = useMemo(() => {
    return edges.filter((e) => {
      const sid = resolveEdgeNodeId(e.source)
      const tid = resolveEdgeNodeId(e.target)
      return sid === node.id || tid === node.id
    })
  }, [edges, node.id])

  const connectedNodeMap = useMemo(() => {
    const map = new Map<string, SimulationNode>()
    for (const n of allNodes) {
      map.set(n.id, n)
    }
    return map
  }, [allNodes])

  // Group connections by category
  const connectionsByCategory = useMemo(() => {
    const groups = new Map<GraphCategory, { node: SimulationNode; edge: SimulationEdge }[]>()

    for (const edge of connectedEdges) {
      const sid = resolveEdgeNodeId(edge.source)
      const tid = resolveEdgeNodeId(edge.target)
      const otherId = sid === node.id ? tid : sid

      const otherNode = connectedNodeMap.get(otherId)
      if (!otherNode || otherNode.isGroup) continue

      const cat = otherNode.category
      const arr = groups.get(cat) ?? []
      arr.push({ node: otherNode, edge })
      groups.set(cat, arr)
    }

    return groups
  }, [connectedEdges, connectedNodeMap, node.id])

  // Already connected IDs
  const connectedIds = useMemo(() => {
    const ids = new Set<string>()
    ids.add(node.id)
    for (const edge of connectedEdges) {
      ids.add(resolveEdgeNodeId(edge.source))
      ids.add(resolveEdgeNodeId(edge.target))
    }
    return ids
  }, [connectedEdges, node.id])

  // Search results for adding connections
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return allNodes
      .filter((n) => {
        if (n.isGroup) return false
        if (connectedIds.has(n.id)) return false
        if (entityTypeToCategory(n.type) === node.category) return false
        return n.label.toLowerCase().includes(q)
      })
      .slice(0, 8)
  }, [searchQuery, allNodes, connectedIds, node.category])

  const handleRemoveConnection = useCallback(
    async (edge: SimulationEdge, otherNode: SimulationNode) => {
      const edgeId = edge.id
      setRemovingEdgeId(edgeId)
      try {
        await unlinkEntities(projectId, node.type, node.id, otherNode.type, otherNode.id)
        await onRefresh()
      } catch {
        // silently fail
      } finally {
        setRemovingEdgeId(null)
      }
    },
    [projectId, node.type, node.id, onRefresh],
  )

  const handleAddConnection = useCallback(
    async (targetNode: SimulationNode) => {
      setAddingNodeId(targetNode.id)
      try {
        await linkEntities(projectId, node.type, node.id, targetNode.type, targetNode.id)
        await onRefresh()
        setSearchQuery('')
        setIsAddingConnection(false)
      } catch {
        // silently fail
      } finally {
        setAddingNodeId(null)
      }
    },
    [projectId, node.type, node.id, onRefresh],
  )

  const detailUrl = getEntityDetailUrl(projectId, node.type, node.id)

  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-20 flex w-[320px] flex-col border-l border-[color:var(--border-subtle)] bg-[color:var(--background)] font-mono text-sm"
      style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.2)' }}
    >
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-[color:var(--border-subtle)] p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span style={{ color: categoryColor }}><Icon className="h-4 w-4 shrink-0" /></span>
            <div className="min-w-0">
              <div className="truncate text-[color:var(--foreground)]">{node.label}</div>
              {node.sublabel && (
                <div className="truncate text-[9px] text-[color:var(--text-tertiary)]">
                  {node.sublabel}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer p-1 text-[color:var(--text-tertiary)] hover:text-[color:var(--foreground)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-[2px] px-1.5 py-0.5 text-[9px] uppercase"
            style={{ backgroundColor: categoryColor + '20', color: categoryColor }}
          >
            {CATEGORY_LABELS[node.category]}
          </span>
          {detailUrl && (
            <a
              href={detailUrl}
              className="flex items-center gap-1 text-[9px] text-[color:var(--text-tertiary)] hover:text-[color:var(--accent-info)]"
            >
              <ExternalLink className="h-3 w-3" />
              <span>Details</span>
            </a>
          )}
        </div>
      </div>

      {/* Connections */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="mb-2 text-[10px] uppercase text-[color:var(--text-tertiary)]">
            Connections ({connectedEdges.length})
          </div>

          {connectionsByCategory.size === 0 && (
            <div className="text-[color:var(--text-tertiary)] text-xs py-2">
              No connections
            </div>
          )}

          <div className="flex flex-col gap-3">
            {Array.from(connectionsByCategory.entries()).map(([category, connections]) => {
              const CatIcon = CATEGORY_ICONS[category]
              const color = CATEGORY_HEX[category]

              return (
                <div key={category}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span style={{ color }}><CatIcon className="h-3 w-3" /></span>
                    <span className="text-[9px] uppercase text-[color:var(--text-tertiary)]">
                      {CATEGORY_LABELS[category]}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {connections.map(({ node: connectedNode, edge }) => {
                      const connDetailUrl = getEntityDetailUrl(
                        projectId,
                        connectedNode.type,
                        connectedNode.id,
                      )
                      const isRemoving = removingEdgeId === edge.id
                      const metadata = edge.metadata

                      return (
                        <div
                          key={connectedNode.id}
                          className="group flex items-start justify-between gap-1 rounded-[2px] px-2 py-1.5 hover:bg-[color:var(--surface-hover)]"
                        >
                          <div className="min-w-0 flex-1">
                            <button
                              onClick={() => onNavigateToNode(connectedNode.id)}
                              className="cursor-pointer truncate text-left text-[color:var(--foreground)] hover:text-[color:var(--accent-info)]"
                            >
                              {connectedNode.label}
                            </button>
                            {metadata && Object.keys(metadata).length > 0 && (
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                {Object.entries(metadata).map(([key, value]) => (
                                  <div
                                    key={key}
                                    className="text-[9px] text-[color:var(--text-tertiary)]"
                                  >
                                    {key}: {String(value)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            {connDetailUrl && (
                              <a
                                href={connDetailUrl}
                                className="cursor-pointer p-0.5 text-[color:var(--text-tertiary)] hover:text-[color:var(--accent-info)]"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <button
                              onClick={() => handleRemoveConnection(edge, connectedNode)}
                              disabled={isRemoving}
                              className="cursor-pointer p-0.5 text-[color:var(--text-tertiary)] hover:text-[color:var(--accent-danger)] disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Add Connection */}
      <div className="border-t border-[color:var(--border-subtle)] p-4">
        {!isAddingConnection ? (
          <button
            onClick={() => setIsAddingConnection(true)}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[2px] border border-dashed border-[color:var(--border-subtle)] px-3 py-2 text-[10px] uppercase text-[color:var(--text-tertiary)] hover:border-[color:var(--text-secondary)] hover:text-[color:var(--text-secondary)]"
          >
            <Plus className="h-3 w-3" />
            Add Connection
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[color:var(--text-tertiary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entities..."
                autoFocus
                className="w-full rounded-[2px] border border-[color:var(--border-subtle)] bg-transparent py-1.5 pl-7 pr-2 font-mono text-xs text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--text-secondary)] focus:outline-none"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
                {searchResults.map((result) => {
                  const color = CATEGORY_HEX[result.category]
                  const isAdding = addingNodeId === result.id

                  return (
                    <button
                      key={result.id}
                      onClick={() => handleAddConnection(result)}
                      disabled={isAdding}
                      className="flex cursor-pointer items-center gap-2 rounded-[2px] px-2 py-1.5 text-left hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                    >
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate text-xs text-[color:var(--foreground)]">
                        {result.label}
                      </span>
                      <span className="ml-auto text-[9px] text-[color:var(--text-tertiary)]">
                        {result.type}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {searchQuery.trim() && searchResults.length === 0 && (
              <div className="text-[9px] text-[color:var(--text-tertiary)] px-2">
                No matching entities
              </div>
            )}
            <button
              onClick={() => {
                setIsAddingConnection(false)
                setSearchQuery('')
              }}
              className="cursor-pointer text-[9px] text-[color:var(--text-tertiary)] hover:text-[color:var(--foreground)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
