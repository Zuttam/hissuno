'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { quadtree } from 'd3-quadtree'
import type { Quadtree } from 'd3-quadtree'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import type { ZoomBehavior, ZoomTransform } from 'd3-zoom'

import type { RenderState, HoveredEdgeInfo } from './use-canvas-renderer'
import type { GraphCategory, SimulationEdge, SimulationNode } from './types'

interface UseGraphInteractionsOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  nodes: SimulationNode[]
  edges: SimulationEdge[]
  tick: number
  onPinNode: (nodeId: string, x: number, y: number) => void
  onUnpinNode: (nodeId: string) => void
  onExpandCategory: (category: GraphCategory) => void
  onExpandCompany: (companyId: string) => void
  hiddenCategories: Set<GraphCategory>
  onSelectNode?: (nodeId: string | null) => void
}

interface UseGraphInteractionsResult {
  transformRef: React.RefObject<ZoomTransform>
  renderState: RenderState
}

function sourceId(edge: SimulationEdge): string {
  return typeof edge.source === 'string' ? edge.source : edge.source.id
}

function targetId(edge: SimulationEdge): string {
  return typeof edge.target === 'string' ? edge.target : edge.target.id
}

/** Distance from point (px,py) to line segment (ax,ay)-(bx,by) */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = ax + t * dx
  const projY = ay + t * dy
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

function findEdgeAt(
  sx: number, sy: number, edges: SimulationEdge[], threshold: number,
): SimulationEdge | null {
  let best: SimulationEdge | null = null
  let bestDist = threshold
  for (const edge of edges) {
    const s = typeof edge.source === 'string' ? null : edge.source
    const t = typeof edge.target === 'string' ? null : edge.target
    if (!s || !t) continue
    const d = distToSegment(sx, sy, s.x, s.y, t.x, t.y)
    if (d < bestDist) {
      bestDist = d
      best = edge
    }
  }
  return best
}

function getConnectedNodeIds(nodeId: string, edges: SimulationEdge[]): Set<string> {
  const connected = new Set<string>()
  connected.add(nodeId)
  for (const edge of edges) {
    const sid = sourceId(edge)
    const tid = targetId(edge)
    if (sid === nodeId) connected.add(tid)
    if (tid === nodeId) connected.add(sid)
  }
  return connected
}

export function useGraphInteractions({
  canvasRef,
  nodes,
  edges,
  tick,
  onPinNode,
  onUnpinNode,
  onExpandCategory,
  onExpandCompany,
  hiddenCategories,
  onSelectNode,
}: UseGraphInteractionsOptions): UseGraphInteractionsResult {
  const transformRef = useRef<ZoomTransform>(zoomIdentity)
  const qtreeRef = useRef<Quadtree<SimulationNode> | null>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
  const dragNodeRef = useRef<SimulationNode | null>(null)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const hiddenRef = useRef(hiddenCategories)
  hiddenRef.current = hiddenCategories

  const [renderState, setRenderState] = useState<RenderState>({
    hoveredNodeId: null,
    selectedNodeId: null,
    connectedNodeIds: new Set(),
    hoveredEdge: null,
  })

  // Keep refs up to date
  nodesRef.current = nodes
  edgesRef.current = edges

  // Rebuild quadtree on every tick (d3-force mutates positions in place)
  useEffect(() => {
    if (nodes.length === 0) {
      qtreeRef.current = null
      return
    }
    qtreeRef.current = quadtree<SimulationNode>()
      .x((d) => d.x)
      .y((d) => d.y)
      .addAll(nodes)
  }, [nodes, tick])

  // Hit test: find nearest node within its radius + 4px padding
  const findNodeAt = useCallback(
    (sx: number, sy: number): SimulationNode | null => {
      const qt = qtreeRef.current
      if (!qt) return null

      let found: SimulationNode | null = null
      let bestDist = Infinity

      // Search with a reasonable radius
      const searchRadius = 30
      qt.visit((quadNode, x0, y0, x1, y1) => {
        // If the quad is too far away, skip
        if (x0 > sx + searchRadius || x1 < sx - searchRadius) return true
        if (y0 > sy + searchRadius || y1 < sy - searchRadius) return true

        if (!('length' in quadNode)) {
          // Leaf node - check all data points
          let leaf: typeof quadNode | undefined = quadNode
          while (leaf) {
            const node = leaf.data
            const dx = node.x - sx
            const dy = node.y - sy
            const dist = Math.sqrt(dx * dx + dy * dy)
            const hitRadius = node.radius + 4
            if (dist < hitRadius && dist < bestDist && !hiddenRef.current.has(node.category)) {
              bestDist = dist
              found = node
            }
            leaf = leaf.next
          }
        }
        return false
      })

      return found
    },
    [],
  )

  // Convert client coordinates to simulation space
  const clientToSim = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      const t = transformRef.current
      const px = clientX - rect.left
      const py = clientY - rect.top
      return {
        x: (px - t.x) / t.k,
        y: (py - t.y) / t.k,
      }
    },
    [canvasRef],
  )

  // Set up zoom + mouse interactions
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sel = select<HTMLCanvasElement, unknown>(canvas)

    // Track whether we're mid-drag so zoom filter can block panning
    let isDragging = false
    // Track drag start to distinguish click vs drag
    let dragStartPos: { x: number; y: number } | null = null

    // Zoom behavior - filter blocks panning when dragging a node
    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .filter((event: Event) => {
        if (event.type === 'wheel') return true
        if (event.type === 'dblclick') return false
        if (isDragging) return false
        if (event.type === 'mousedown' || event.type === 'touchstart') {
          const me = event as MouseEvent
          if (me.button !== 0) return true
          const { x, y } = clientToSim(me.clientX, me.clientY)
          const hitNode = findNodeAt(x, y)
          if (hitNode) return false
        }
        return true
      })
      .on('zoom', (event) => {
        transformRef.current = event.transform
        setRenderState((prev) => ({ ...prev }))
      })

    zoomBehaviorRef.current = zoomBehavior
    sel.call(zoomBehavior)
    sel.on('dblclick.zoom', null)

    // Mouse down - start drag for entity nodes
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      const { x, y } = clientToSim(event.clientX, event.clientY)
      const hitNode = findNodeAt(x, y)
      if (hitNode) {
        isDragging = true
        dragNodeRef.current = hitNode
        dragStartPos = { x: event.clientX, y: event.clientY }
        onPinNode(hitNode.id, x, y)
        canvas.style.cursor = 'grabbing'
        // Disable zoom panning while dragging a node
        sel.on('.zoom', null)
      }
    }

    // Mouse move - drag or hover
    const onMouseMove = (event: MouseEvent) => {
      if (isDragging && dragNodeRef.current) {
        const { x, y } = clientToSim(event.clientX, event.clientY)
        onPinNode(dragNodeRef.current.id, x, y)
        return
      }

      const { x, y } = clientToSim(event.clientX, event.clientY)
      const hitNode = findNodeAt(x, y)

      if (hitNode) {
        canvas.style.cursor = 'pointer'
        setRenderState((prev) => {
          if (prev.hoveredNodeId === hitNode.id && !prev.hoveredEdge) return prev
          return { ...prev, hoveredNodeId: hitNode.id, hoveredEdge: null }
        })
      } else {
        // Check for edge hover (threshold in simulation-space, so scale by zoom)
        const zoomScale = transformRef.current?.k ?? 1
        const visibleEdges = edgesRef.current.filter((e) => {
          const s = typeof e.source === 'string' ? null : e.source
          const t = typeof e.target === 'string' ? null : e.target
          return s && t && !hiddenRef.current.has(s.category) && !hiddenRef.current.has(t.category)
        })
        const hitEdge = findEdgeAt(x, y, visibleEdges, 10 / zoomScale)
        canvas.style.cursor = hitEdge ? 'pointer' : 'grab'

        // Compute screen position for tooltip
        const rect = canvasRef.current?.getBoundingClientRect()
        const edgeInfo: HoveredEdgeInfo | null = hitEdge ? {
          edge: hitEdge,
          screenX: event.clientX - (rect?.left ?? 0),
          screenY: event.clientY - (rect?.top ?? 0),
        } : null

        setRenderState((prev) => {
          const sameNode = prev.hoveredNodeId === null
          const sameEdge = prev.hoveredEdge?.edge.id === (edgeInfo?.edge.id ?? null)
          if (sameNode && sameEdge) return prev
          return { ...prev, hoveredNodeId: null, hoveredEdge: edgeInfo }
        })
      }
    }

    // Mouse up - end drag, handle click
    const onMouseUp = (event: MouseEvent) => {
      const wasDragging = isDragging
      const dragNode = dragNodeRef.current
      const startPos = dragStartPos

      isDragging = false
      dragNodeRef.current = null
      dragStartPos = null
      canvas.style.cursor = 'grab'

      // Re-enable zoom after drag
      if (wasDragging) {
        sel.call(zoomBehavior)
        sel.on('dblclick.zoom', null)
      }

      // If we were dragging but barely moved, treat as click
      if (wasDragging && dragNode && startPos) {
        const dx = event.clientX - startPos.x
        const dy = event.clientY - startPos.y
        const moved = Math.sqrt(dx * dx + dy * dy)
        if (moved < 5) {
          // Click on this node
          const connected = getConnectedNodeIds(dragNode.id, edgesRef.current)
          setRenderState({
            hoveredNodeId: dragNode.id,
            selectedNodeId: dragNode.id,
            connectedNodeIds: connected,
            hoveredEdge: null,
          })
          onSelectNode?.(dragNode.id)
        }
      }
    }

    // Click - select or deselect (only for non-node clicks)
    const onClick = (event: MouseEvent) => {
      const { x, y } = clientToSim(event.clientX, event.clientY)
      const hitNode = findNodeAt(x, y)

      if (hitNode) {
        if (hitNode.isGroup) {
          // Category group nodes have synthetic IDs (__group__*), company sub-groups use real UUIDs
          if (hitNode.id.startsWith('__group__')) {
            onExpandCategory(hitNode.category)
          } else {
            onExpandCompany(hitNode.id)
          }
          return
        }
        // Entity node clicks handled in onMouseUp (drag/click detection)
      } else {
        setRenderState({
          hoveredNodeId: null,
          selectedNodeId: null,
          connectedNodeIds: new Set(),
          hoveredEdge: null,
        })
        onSelectNode?.(null)
      }
    }

    // Double click - unpin node
    const onDblClick = (event: MouseEvent) => {
      const { x, y } = clientToSim(event.clientX, event.clientY)
      const hitNode = findNodeAt(x, y)
      if (hitNode && hitNode.fx !== null) {
        onUnpinNode(hitNode.id)
      }
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('dblclick', onDblClick)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('dblclick', onDblClick)
      sel.on('.zoom', null)
    }
  }, [canvasRef, clientToSim, findNodeAt, onPinNode, onUnpinNode, onExpandCategory, onExpandCompany, onSelectNode])

  return { transformRef, renderState }
}
