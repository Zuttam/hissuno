'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { GraphCategory, GraphData } from './types'
import { useForceSimulation } from './use-force-simulation'
import { useGraphInteractions } from './use-graph-interactions'
import { useCanvasRenderer } from './use-canvas-renderer'
import { GraphToolbar } from './graph-toolbar'
import { IssueSidebar } from '@/components/issues/issue-sidebar'
import { CompanySidebar } from '@/components/customers/company-sidebar'
import { ContactSidebar } from '@/components/customers/contact-sidebar'
import { SessionSidebar } from '@/components/sessions/session-sidebar/session-sidebar'
import { useSessionDetail } from '@/hooks/use-sessions'

interface CanvasGraphProps {
  data: GraphData
  projectId: string
  onRefresh: () => Promise<void>
  includeOrphans: boolean
  onToggleOrphans: (value: boolean) => void
}

export function CanvasGraph({ data, projectId, onRefresh, includeOrphans, onToggleOrphans }: CanvasGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hiddenCategories, setHiddenCategories] = useState<Set<GraphCategory>>(() => new Set())
  const router = useRouter()

  // Measure container with ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setDimensions({ width, height })
      }
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  // Force simulation
  const {
    nodes,
    edges,
    tick,
    expandCategory,
    expandCompany,
    pinNode,
    unpinNode,
  } = useForceSimulation(data, dimensions.width, dimensions.height)

  // Select node callback - navigate away for knowledge_source/product_scope
  // Uses a ref lookup to avoid recreating on every simulation tick
  const nodesLookupRef = useRef(nodes)
  nodesLookupRef.current = nodes

  const onSelectNode = useCallback((nodeId: string | null) => {
    if (nodeId) {
      const node = nodesLookupRef.current.find((n) => n.id === nodeId && !n.isGroup)
      if (node?.type === 'knowledge_source') {
        router.push(`/projects/${projectId}/knowledge?source=${nodeId}`)
        return
      }
      if (node?.type === 'product_scope') {
        router.push(`/projects/${projectId}/products?area=${nodeId}`)
        return
      }
    }
    setSelectedNodeId(nodeId)
  }, [projectId, router])

  // Graph interactions
  const { transformRef, renderState } = useGraphInteractions({
    canvasRef,
    nodes,
    edges,
    tick,
    onPinNode: pinNode,
    onUnpinNode: unpinNode,
    onExpandCategory: expandCategory,
    onExpandCompany: expandCompany,
    hiddenCategories,
    onSelectNode,
  })

  // Canvas renderer
  useCanvasRenderer({
    canvasRef,
    nodes,
    edges,
    transformRef,
    renderState,
    hiddenCategories,
    tick,
  })

  // Selected node object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return nodes.find((n) => n.id === selectedNodeId && !n.isGroup) ?? null
  }, [selectedNodeId, nodes])

  // Session detail hook (must be called unconditionally)
  const sessionId = selectedNode?.type === 'session' ? selectedNode.id : undefined
  const { session, messages, isLoading: sessionLoading } = useSessionDetail({
    projectId,
    sessionId: sessionId ?? '',
  })

  // Handle close side panel
  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  // Render the appropriate sidebar based on node type
  const renderSidebar = () => {
    if (!selectedNode) return null

    let sidebarContent: React.ReactNode = null

    switch (selectedNode.type) {
      case 'company':
        sidebarContent = (
          <CompanySidebar
            projectId={projectId}
            companyId={selectedNode.id}
            onClose={handleClosePanel}
            onCompanyUpdated={onRefresh}
          />
        )
        break
      case 'contact':
        sidebarContent = (
          <ContactSidebar
            projectId={projectId}
            contactId={selectedNode.id}
            onClose={handleClosePanel}
            onContactUpdated={onRefresh}
          />
        )
        break
      case 'issue':
        sidebarContent = (
          <IssueSidebar
            projectId={projectId}
            issueId={selectedNode.id}
            onClose={handleClosePanel}
            onIssueUpdated={onRefresh}
          />
        )
        break
      case 'session':
        sidebarContent = (
          <SessionSidebar
            session={session}
            messages={messages}
            isLoading={sessionLoading}
            onClose={handleClosePanel}
            onSessionUpdated={onRefresh}
          />
        )
        break
      default:
        return null
    }

    return (
      <div className="h-full w-[420px] flex-shrink-0 overflow-y-auto border-l border-[color:var(--border-subtle)]">
        {sidebarContent}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative flex h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ display: 'block' }}
      />

      <GraphToolbar
        includeOrphans={includeOrphans}
        onToggleOrphans={onToggleOrphans}
        hiddenCategories={hiddenCategories}
        onToggleCategory={(cat) => {
          setHiddenCategories((prev) => {
            const next = new Set(prev)
            if (next.has(cat)) next.delete(cat)
            else next.add(cat)
            return next
          })
        }}
      />

      {renderState.hoveredEdge && (() => {
        const he = renderState.hoveredEdge
        const src = typeof he.edge.source === 'string' ? null : he.edge.source
        const tgt = typeof he.edge.target === 'string' ? null : he.edge.target
        const meta = he.edge.metadata
        const hasMeta = meta && Object.keys(meta).length > 0
        return (
          <div
            className="pointer-events-none absolute z-20 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)]/95 backdrop-blur-sm px-3 py-2 font-mono text-[10px] shadow-lg"
            style={{
              left: he.screenX + 12,
              top: he.screenY - 8,
              maxWidth: 300,
            }}
          >
            {src && tgt && (
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[color:var(--foreground)] truncate max-w-[120px]">{src.label}</span>
                <span className="text-[color:var(--text-tertiary)]">-</span>
                <span className="text-[color:var(--foreground)] truncate max-w-[120px]">{tgt.label}</span>
              </div>
            )}
            {hasMeta && (
              <div className="flex flex-col gap-0.5 border-t border-[color:var(--border-subtle)] pt-1 mt-0.5">
                {Object.entries(meta!).map(([key, value]) => (
                  <div key={key} className="flex items-baseline gap-1.5">
                    <span className="text-[color:var(--text-tertiary)] flex-shrink-0">{key}:</span>
                    <span className="text-[color:var(--text-secondary)] truncate max-w-[180px]">
                      {typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
                        ? String(value)
                        : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {renderSidebar()}
    </div>
  )
}
