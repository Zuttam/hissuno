'use client'

import { useEffect, useRef } from 'react'
import type { ZoomTransform } from 'd3-zoom'

import type { SimulationEdge, SimulationNode } from './types'
import { CATEGORY_HEX, CATEGORY_LABELS } from './types'

export interface HoveredEdgeInfo {
  edge: SimulationEdge
  /** Screen-space position for the tooltip */
  screenX: number
  screenY: number
}

export interface RenderState {
  hoveredNodeId: string | null
  selectedNodeId: string | null
  connectedNodeIds: Set<string>
  hoveredEdge: HoveredEdgeInfo | null
}

import type { GraphCategory } from './types'

interface UseCanvasRendererOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  nodes: SimulationNode[]
  edges: SimulationEdge[]
  transformRef: React.RefObject<ZoomTransform>
  renderState: RenderState
  hiddenCategories: Set<GraphCategory>
  tick: number
}

function resolveNode(ref: SimulationNode | string): SimulationNode | null {
  return typeof ref === 'string' ? null : ref
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const val = parseInt(hex.slice(1), 16)
  return { r: (val >> 16) & 0xff, g: (val >> 8) & 0xff, b: val & 0xff }
}

export function useCanvasRenderer({
  canvasRef,
  nodes,
  edges,
  transformRef,
  renderState,
  hiddenCategories,
  tick,
}: UseCanvasRendererOptions): void {
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Cancel any pending frame
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    rafRef.current = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight

      // Size the canvas buffer for DPR
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }

      const transform = transformRef.current

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      // Apply zoom transform
      ctx.translate(transform.x, transform.y)
      ctx.scale(transform.k, transform.k)

      const { hoveredNodeId, selectedNodeId, connectedNodeIds } = renderState
      const hasSelection = selectedNodeId !== null
      const activeNodeId = hoveredNodeId ?? selectedNodeId

      // -- Draw edges --
      for (const edge of edges) {
        const s = resolveNode(edge.source)
        const t = resolveNode(edge.target)
        if (!s || !t) continue
        if (hiddenCategories.has(s.category) || hiddenCategories.has(t.category)) continue

        const isHierarchy = edge.edgeType === 'hierarchy'

        let alpha = 0.25
        if (activeNodeId) {
          const sid = s.id
          const tid = t.id
          if (sid === activeNodeId || tid === activeNodeId) {
            alpha = 0.6
          } else if (hasSelection) {
            alpha = 0.06
          }
        }

        ctx.beginPath()
        if (isHierarchy) {
          ctx.setLineDash([4, 4])
        }
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)
        ctx.strokeStyle = isHierarchy
          ? `rgba(167, 139, 250, ${alpha})`
          : `rgba(148, 163, 184, ${alpha})`
        ctx.lineWidth = isHierarchy ? 1.5 : 1
        ctx.stroke()
        if (isHierarchy) {
          ctx.setLineDash([])
        }
      }

      // -- Draw nodes --
      for (const node of nodes) {
        if (hiddenCategories.has(node.category)) continue
        const color = CATEGORY_HEX[node.category]
        const { r, g, b } = hexToRgb(color)
        const isActive = node.id === hoveredNodeId || node.id === selectedNodeId
        const isConnected = connectedNodeIds.has(node.id)

        let nodeAlpha = 1
        if (hasSelection && !isActive && !isConnected) {
          nodeAlpha = 0.08
        }

        // Glow effect for hovered/selected nodes
        if (isActive) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`
          ctx.fill()
        }

        // Node circle
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${nodeAlpha})`
        ctx.fill()

        // Group node: count inside, category label above
        if (node.isGroup) {
          // Count label centered inside
          ctx.fillStyle = `rgba(255, 255, 255, ${nodeAlpha})`
          ctx.font = 'bold 10px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(node.groupCount), node.x, node.y)

          // Category label above
          ctx.fillStyle = `rgba(30, 41, 59, ${nodeAlpha * 0.8})`
          ctx.font = '9px monospace'
          ctx.textBaseline = 'bottom'
          ctx.fillText(CATEGORY_LABELS[node.category], node.x, node.y - node.radius - 4)
        }

        // Entity node labels: show when zoomed in or active/connected
        if (!node.isGroup) {
          const showLabel = transform.k > 1.5 || isActive || (hasSelection && isConnected)
          if (showLabel) {
            const labelAlpha = isActive ? 0.95 : hasSelection && isConnected ? 0.8 : 0.6
            ctx.fillStyle = `rgba(30, 41, 59, ${labelAlpha * nodeAlpha})`
            ctx.font = '9px monospace'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            const label = node.connectionCount > 0
              ? `${truncate(node.label, 18)} (${node.connectionCount})`
              : truncate(node.label, 20)
            ctx.fillText(
              label,
              node.x,
              node.y + node.radius + 3,
            )
          }
        }
      }

      ctx.restore()
    })

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [canvasRef, nodes, edges, transformRef, renderState, tick])
}
