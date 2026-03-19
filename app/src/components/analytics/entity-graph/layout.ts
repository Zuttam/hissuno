import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

// Pentagon positions for the 5 category nodes (top-left based)
const PENTAGON_POSITIONS: Record<string, { x: number; y: number }> = {
  customer:         { x: 345, y: 20 },
  issue:            { x: 625, y: 150 },
  session:          { x: 525, y: 330 },
  knowledge_source: { x: 165, y: 330 },
  product_scope:     { x: 65, y: 150 },
}

export function getPentagonPosition(category: string): { x: number; y: number } {
  return PENTAGON_POSITIONS[category] ?? { x: 0, y: 0 }
}

const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  category: { width: 110, height: 50 },
  group: { width: 120, height: 40 },
  entity: { width: 150, height: 36 },
  cluster: { width: 280, height: 60 },
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options?: { direction?: 'TB' | 'LR'; nodesep?: number; ranksep?: number },
): { nodes: Node[]; edges: Edge[] } {
  const { direction = 'TB', nodesep = 60, ranksep = 80 } = options ?? {}

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep, ranksep })

  for (const node of nodes) {
    const dims = NODE_DIMENSIONS[node.type ?? 'category'] ?? NODE_DIMENSIONS.category
    g.setNode(node.id, { width: dims.width, height: dims.height })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const layoutedNodes = nodes.map(node => {
    const dagreNode = g.node(node.id)
    const dims = NODE_DIMENSIONS[node.type ?? 'category'] ?? NODE_DIMENSIONS.category
    return {
      ...node,
      position: {
        x: dagreNode.x - dims.width / 2,
        y: dagreNode.y - dims.height / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}
