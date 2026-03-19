'use client'

import { useCallback, useRef, useState } from 'react'
import { applyNodeChanges, applyEdgeChanges, type Node, type Edge, type NodeChange, type EdgeChange } from '@xyflow/react'
import { getLayoutedElements } from './layout'
import { getDrilldownData, getChildEntityEdges } from '@/lib/api/analytics'
import type { CategoryNodeData, GroupNodeData, ClusterNodeData } from './nodes'
import type { EntityGraphCategory } from '@/lib/db/queries/analytics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpandedNodeInfo {
  parentNode: Node
  parentEdges: Edge[]
  childIds: string[]
  level: 'groups' | 'entities'
  category: EntityGraphCategory
}

interface UseGraphStateOptions {
  initialNodes: Node[]
  initialEdges: Edge[]
  projectId: string
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGraphState({ initialNodes, initialEdges, projectId }: UseGraphStateOptions) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)

  // Track expansions (using ref to avoid stale closures)
  const expandedMapRef = useRef<Map<string, ExpandedNodeInfo>>(new Map())

  // Keep latest state accessible in callbacks
  const stateRef = useRef({ nodes, edges })
  stateRef.current = { nodes, edges }

  // ReactFlow change handlers (for drag, select, etc.)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds))
  }, [])

  // Collapse a previously expanded node back to its parent
  const collapseNode = useCallback((parentNodeId: string) => {
    const info = expandedMapRef.current.get(parentNodeId)
    if (!info) return

    const { nodes: currentNodes, edges: currentEdges } = stateRef.current

    // Collect all descendant IDs (handle nested expansions)
    const allDescendantIds = new Set<string>()
    const collectDescendants = (ids: string[]) => {
      for (const id of ids) {
        allDescendantIds.add(id)
        const childExpansion = expandedMapRef.current.get(id)
        if (childExpansion) {
          collectDescendants(childExpansion.childIds)
          expandedMapRef.current.delete(id)
        }
      }
    }
    collectDescendants(info.childIds)

    const filteredNodes = currentNodes.filter(n => !allDescendantIds.has(n.id))
    const filteredEdges = currentEdges.filter(
      e => !allDescendantIds.has(e.source) && !allDescendantIds.has(e.target),
    )

    expandedMapRef.current.delete(parentNodeId)

    const restoredNodes = [...filteredNodes, info.parentNode]
    const restoredEdges = [...filteredEdges, ...info.parentEdges]

    if (expandedMapRef.current.size === 0) {
      // Back to initial state - use original positions
      setNodes(restoredNodes)
      setEdges(restoredEdges)
    } else {
      const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(restoredNodes, restoredEdges)
      setNodes(layouted)
      setEdges(layoutedEdges)
    }
  }, [])

  // Expand a category or group node
  const expandNode = useCallback(async (nodeId: string, nodeType: string | undefined) => {
    const { nodes: currentNodes, edges: currentEdges } = stateRef.current
    const node = currentNodes.find(n => n.id === nodeId)
    if (!node) return

    // ------ Expand category → sub-groups ------
    if (nodeType === 'category') {
      const data = node.data as CategoryNodeData
      const category = data.category

      const level = 'groups'
      const result = await getDrilldownData(projectId, category, level)
      if (!result) return

      if (level === 'groups' && result.groups && result.groups.length > 0) {
        const parentEdges = currentEdges.filter(e => e.source === nodeId || e.target === nodeId)

        // Create a single cluster node that contains all sub-groups
        const clusterId = `cluster-${category}`
        const childIds = [clusterId]

        const clusterNode: Node = {
          id: clusterId,
          type: 'cluster',
          position: { x: node.position.x, y: node.position.y },
          data: {
            category,
            groups: result.groups,
            projectId,
            onCollapse: () => collapseNode(nodeId),
            onGroupDrilldown: (groupId: string) => {
              void drilldownGroup(clusterId, category, groupId)
            },
            onGroupCollapse: (groupId: string) => {
              collapseGroup(clusterId, groupId)
            },
          } satisfies ClusterNodeData,
        }

        expandedMapRef.current.set(nodeId, {
          parentNode: node,
          parentEdges,
          childIds,
          level: 'groups',
          category,
        })

        // Reconnect edges to the cluster node
        const remainingEdges = currentEdges.filter(e => e.source !== nodeId && e.target !== nodeId)
        const newEdges: Edge[] = parentEdges.map(e => {
          const ed = e.data as Record<string, unknown>
          const isSource = e.source === nodeId
          return {
            ...e,
            id: `e-${clusterId}-${isSource ? e.target : e.source}`,
            source: isSource ? clusterId : e.source,
            target: isSource ? e.target : clusterId,
            data: { ...ed },
          }
        })

        const updatedNodes = [...currentNodes.filter(n => n.id !== nodeId), clusterNode]
        const updatedEdges = [...remainingEdges, ...newEdges]
        const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(updatedNodes, updatedEdges)
        setNodes(layouted)
        setEdges(layoutedEdges)
        return
      }

      // Fallback: no sub-groups returned, try entities directly
      if (result.entities && result.entities.length > 0) {
        expandToEntities(nodeId, node, category, result.entities, currentNodes, currentEdges)
        return
      }
    }

    // ------ Expand group → individual entities ------
    if (nodeType === 'group') {
      const data = node.data as GroupNodeData
      const category = data.parentCategory
      const groupId = data.groupId

      const { groupBy, groupValue } = resolveGroupParams(category, groupId)
      const result = await getDrilldownData(projectId, category, 'entities', groupBy, groupValue, 20)
      if (!result?.entities || result.entities.length === 0) return

      expandToEntities(nodeId, node, category, result.entities, currentNodes, currentEdges)
    }
  }, [projectId, collapseNode])

  // Helper: expand a node into individual entity nodes
  function expandToEntities(
    nodeId: string,
    node: Node,
    category: EntityGraphCategory,
    entities: Array<{ id: string; label: string; sublabel?: string; entityType: string }>,
    currentNodes: Node[],
    currentEdges: Edge[],
  ) {
    const parentEdges = currentEdges.filter(e => e.source === nodeId || e.target === nodeId)
    const connectedNodes = new Set<string>()
    for (const e of parentEdges) {
      if (e.source === nodeId) connectedNodes.add(e.target)
      if (e.target === nodeId) connectedNodes.add(e.source)
    }

    const childIds: string[] = []
    const newNodes: Node[] = []

    for (const entity of entities) {
      const childId = `entity-${entity.id}`
      childIds.push(childId)
      newNodes.push({
        id: childId,
        type: 'entity',
        position: { x: node.position.x, y: node.position.y },
        data: {
          entityId: entity.id,
          label: entity.label,
          sublabel: entity.sublabel,
          category,
          entityType: entity.entityType,
        },
      })
    }

    expandedMapRef.current.set(nodeId, {
      parentNode: node,
      parentEdges,
      childIds,
      level: 'entities',
      category,
    })

    // Redistribute edges
    const remainingEdges = currentEdges.filter(e => e.source !== nodeId && e.target !== nodeId)
    const newEdges: Edge[] = []

    for (const childId of childIds) {
      for (const connNode of connectedNodes) {
        const originalEdge = parentEdges.find(
          e => (e.source === nodeId && e.target === connNode) ||
               (e.target === nodeId && e.source === connNode),
        )
        if (!originalEdge) continue
        const ed = originalEdge.data as Record<string, unknown>
        newEdges.push({
          id: `e-${childId}-${connNode}`,
          source: childId,
          target: connNode,
          type: 'gradient',
          data: { ...ed, count: 1 },
        })
      }
    }

    const updatedNodes = [...currentNodes.filter(n => n.id !== nodeId), ...newNodes]
    const updatedEdges = [...remainingEdges, ...newEdges]
    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(updatedNodes, updatedEdges)
    setNodes(layouted)
    setEdges(layoutedEdges)
  }

  // Resolve groupBy/groupValue params for a category + groupId
  function resolveGroupParams(category: EntityGraphCategory, groupId: string) {
    let groupBy: string | undefined
    let groupValue: string | undefined

    if (category === 'customer') {
      groupBy = 'entity_type'
      groupValue = groupId
    } else if (category === 'issue' || category === 'session') {
      groupBy = 'status'
      groupValue = groupId
    } else if (category === 'knowledge_source') {
      groupBy = 'type'
      groupValue = groupId
    } else if (category === 'product_scope') {
      groupBy = 'type'
      groupValue = groupId
    }

    return { groupBy, groupValue }
  }

  // Drilldown: expand a group inside a cluster node inline (nested cluster)
  async function drilldownGroup(clusterNodeId: string, category: EntityGraphCategory, groupId: string) {
    const { groupBy, groupValue } = resolveGroupParams(category, groupId)
    const result = await getDrilldownData(projectId, category, 'entities', groupBy, groupValue, 20)
    if (!result?.entities || result.entities.length === 0) return

    // Fetch connection data for the entities (graceful fallback on failure)
    let entities = result.entities
    try {
      const childIds = entities.map(e => e.id)
      const edgeMap = await getChildEntityEdges(projectId, category, childIds)
      if (edgeMap) {
        entities = entities.map(e => ({
          ...e,
          connections: (edgeMap[e.id] ?? []) as EntityGraphCategory[],
        }))
      }
    } catch {
      // Entities still render without connection dots
    }

    // Update the cluster node's data to expand this group inline
    setNodes(nds => nds.map(n => {
      if (n.id !== clusterNodeId) return n
      const d = n.data as ClusterNodeData
      return {
        ...n,
        data: {
          ...d,
          groups: d.groups.map(g =>
            g.id === groupId
              ? { ...g, expanded: true, entities }
              : g,
          ),
        },
      }
    }))
  }

  // Collapse an expanded group back to its summary inside a cluster node
  function collapseGroup(clusterNodeId: string, groupId: string) {
    setNodes(nds => nds.map(n => {
      if (n.id !== clusterNodeId) return n
      const d = n.data as ClusterNodeData
      return {
        ...n,
        data: {
          ...d,
          groups: d.groups.map(g =>
            g.id === groupId
              ? { ...g, expanded: false, entities: undefined }
              : g,
          ),
        },
      }
    }))
  }

  // Double-click handler
  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'category' || node.type === 'group') {
      void expandNode(node.id, node.type)
    }
  }, [expandNode])

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onNodeDoubleClick,
  }
}
