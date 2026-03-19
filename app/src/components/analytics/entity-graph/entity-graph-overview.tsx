'use client'

import { useMemo } from 'react'
import { ReactFlow, Background, BackgroundVariant, Controls, type Node, type Edge } from '@xyflow/react'
import { CategoryNode, GroupNode, EntityNode, ClusterNode } from './nodes'
import { GradientEdge } from './edges'
import { getPentagonPosition } from './layout'
import { useGraphState } from './use-graph-state'
import type {
  EntityGraphCategory,
  EntityGraphCategoryNode,
  EntityGraphCategoryEdge,
  EntityGraphEntityNode,
} from '@/lib/db/queries/analytics'
import type { CategoryNodeData } from './nodes'
import type { GradientEdgeData } from './edges'

// Register custom node/edge types (must be outside component to avoid re-renders)
const nodeTypes = {
  category: CategoryNode,
  group: GroupNode,
  entity: EntityNode,
  cluster: ClusterNode,
}

const edgeTypes = {
  gradient: GradientEdge,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EntityGraphOverviewProps {
  categories: EntityGraphCategoryNode[]
  edges: EntityGraphCategoryEdge[]
  recentEntities: Record<EntityGraphCategory, EntityGraphEntityNode[]>
  projectId: string
}

export function EntityGraphOverview({
  categories,
  edges: edgeData,
  recentEntities,
  projectId,
}: EntityGraphOverviewProps) {
  const maxEdgeCount = useMemo(
    () => Math.max(1, ...edgeData.map(e => e.count)),
    [edgeData],
  )

  const initialNodes = useMemo<Node[]>(
    () =>
      categories.map(cat => ({
        id: cat.category,
        type: 'category' as const,
        position: getPentagonPosition(cat.category),
        data: {
          category: cat.category,
          count: cat.count,
          recentEntities: recentEntities[cat.category] ?? [],
          projectId,
        } satisfies CategoryNodeData,
      })),
    [categories, recentEntities, projectId],
  )

  const initialEdges = useMemo<Edge[]>(
    () =>
      edgeData.map(edge => ({
        id: `e-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'gradient' as const,
        data: {
          count: edge.count,
          maxCount: maxEdgeCount,
          sourceCategory: edge.source,
          targetCategory: edge.target,
          projectId,
        } satisfies GradientEdgeData,
      })),
    [edgeData, maxEdgeCount, projectId],
  )

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onNodeDoubleClick,
  } = useGraphState({ initialNodes, initialEdges, projectId })

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDoubleClick={onNodeDoubleClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      nodesDraggable
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
