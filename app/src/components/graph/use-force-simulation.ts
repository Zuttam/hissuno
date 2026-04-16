'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force'
import type { Simulation } from 'd3-force'

import type {
  GraphCategory,
  GraphData,
  SimulationEdge,
  SimulationNode,
} from './types'
import {
  CATEGORY_LABELS,
  GROUP_THRESHOLD,
  entityTypeToCategory,
  nodeRadius,
} from './types'

// Category centroid offsets from center
const CATEGORY_CENTROIDS: Record<GraphCategory, { x: number; y: number }> = {
  customer: { x: -400, y: -300 },
  issue: { x: 400, y: -300 },
  session: { x: -400, y: 300 },
  knowledge_source: { x: 400, y: 300 },
  product_scope: { x: 0, y: 0 },
}

function groupNodeId(category: GraphCategory): string {
  return `__group__${category}`
}

interface BuildResult {
  nodes: SimulationNode[]
  edges: SimulationEdge[]
}

function buildGraph(
  data: GraphData,
  expandedCategories: Set<GraphCategory>,
  expandedCompanies: Set<string>,
  width: number,
  height: number,
): BuildResult {
  const cx = width / 2
  const cy = height / 2

  // Count connections per node
  const connectionCounts = new Map<string, number>()
  for (const edge of data.edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) ?? 0) + 1)
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) ?? 0) + 1)
  }

  // Group nodes by category
  const byCategory = new Map<GraphCategory, typeof data.nodes>()
  for (const node of data.nodes) {
    const cat = entityTypeToCategory(node.type)
    const arr = byCategory.get(cat)
    if (arr) arr.push(node)
    else byCategory.set(cat, [node])
  }

  // Categories collapse only if they have >= threshold entities and aren't expanded
  const collapsedCategories = new Set<GraphCategory>()
  for (const [cat, catNodes] of byCategory) {
    if (catNodes.length >= GROUP_THRESHOLD && !expandedCategories.has(cat)) {
      collapsedCategories.add(cat)
    }
  }

  // Track which node IDs are collapsed into groups
  const collapsedNodeIds = new Set<string>()
  const nodes: SimulationNode[] = []

  // Create group nodes for collapsed categories
  for (const cat of collapsedCategories) {
    const catNodes = byCategory.get(cat) ?? []
    const entityIds = catNodes.map((n) => n.id)
    for (const id of entityIds) collapsedNodeIds.add(id)

    const centroid = CATEGORY_CENTROIDS[cat]
    const totalConnections = catNodes.reduce(
      (sum, n) => sum + (connectionCounts.get(n.id) ?? 0),
      0,
    )

    nodes.push({
      id: groupNodeId(cat),
      type: catNodes[0].type,
      category: cat,
      label: CATEGORY_LABELS[cat],
      x: cx + centroid.x + (Math.random() - 0.5) * 20,
      y: cy + centroid.y + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
      radius: nodeRadius(totalConnections, true),
      connectionCount: totalConnections,
      isGroup: true,
      groupCount: catNodes.length,
      groupEntityIds: entityIds,
    })
  }

  // Customer sub-grouping: when customer category is expanded,
  // show companies as intermediate group nodes and collapse contacts into them
  const customerExpanded = expandedCategories.has('customer') && !collapsedCategories.has('customer')
  const contactsCollapsedIntoCompany = new Set<string>()

  if (customerExpanded) {
    const customerNodes = byCategory.get('customer') ?? []
    const companyNodes = customerNodes.filter(n => n.type === 'company')
    const contactNodes = customerNodes.filter(n => n.type === 'contact')

    // Group contacts by company
    const contactsByCompany = new Map<string, typeof contactNodes>()
    const orphanContacts: typeof contactNodes = []
    for (const contact of contactNodes) {
      if (contact.parentId) {
        const arr = contactsByCompany.get(contact.parentId)
        if (arr) arr.push(contact)
        else contactsByCompany.set(contact.parentId, [contact])
      } else {
        orphanContacts.push(contact)
      }
    }

    // For each company with contacts: show as group node unless expanded
    const centroid = CATEGORY_CENTROIDS.customer
    for (const company of companyNodes) {
      const companyContacts = contactsByCompany.get(company.id) ?? []

      if (companyContacts.length > 0 && !expandedCompanies.has(company.id)) {
        // Collapse contacts into the company group node
        const allIds = [company.id, ...companyContacts.map(c => c.id)]
        for (const c of companyContacts) {
          contactsCollapsedIntoCompany.add(c.id)
          collapsedNodeIds.add(c.id)
        }
        const totalConn = allIds.reduce((sum, id) => sum + (connectionCounts.get(id) ?? 0), 0)

        nodes.push({
          id: company.id,
          type: 'company',
          category: 'customer',
          label: company.label,
          sublabel: company.sublabel,
          x: cx + centroid.x + (Math.random() - 0.5) * 100,
          y: cy + centroid.y + (Math.random() - 0.5) * 100,
          vx: 0, vy: 0, fx: null, fy: null,
          radius: nodeRadius(totalConn, true),
          connectionCount: totalConn,
          isGroup: true,
          groupCount: companyContacts.length,
          groupEntityIds: companyContacts.map(c => c.id),
        })
        collapsedNodeIds.add(company.id) // mark original company as handled
      }
      // If expanded or no contacts, the company shows as a regular node (handled below)
    }

    // Orphan contacts (no company) show as regular nodes
    // Contacts in expanded companies show as regular nodes (handled below)
  }

  // Add individual nodes (non-collapsed)
  for (const node of data.nodes) {
    if (collapsedNodeIds.has(node.id)) continue

    const cat = entityTypeToCategory(node.type)
    const centroid = CATEGORY_CENTROIDS[cat]
    const conn = connectionCounts.get(node.id) ?? 0

    nodes.push({
      id: node.id,
      type: node.type,
      category: cat,
      label: node.label,
      sublabel: node.sublabel,
      x: cx + centroid.x + (Math.random() - 0.5) * 100,
      y: cy + centroid.y + (Math.random() - 0.5) * 100,
      vx: 0, vy: 0, fx: null, fy: null,
      radius: nodeRadius(conn, false),
      connectionCount: conn,
      isGroup: false,
      groupCount: 0,
    })
  }

  // Build edge set, redirecting to group nodes and deduplicating
  const nodeIdSet = new Set(nodes.map((n) => n.id))
  const edgeDedup = new Map<string, SimulationEdge>()

  for (const edge of data.edges) {
    let sourceId = edge.source
    let targetId = edge.target

    // Redirect collapsed nodes to their group node
    if (collapsedNodeIds.has(sourceId)) {
      const cat = entityTypeToCategory(edge.sourceType)
      sourceId = groupNodeId(cat)
    }
    if (collapsedNodeIds.has(targetId)) {
      const cat = entityTypeToCategory(edge.targetType)
      targetId = groupNodeId(cat)
    }

    // Skip self-loops (both endpoints collapsed to same group)
    if (sourceId === targetId) continue
    // Skip if either node doesn't exist
    if (!nodeIdSet.has(sourceId) || !nodeIdSet.has(targetId)) continue

    // Dedup key - sorted to handle both directions
    const key = sourceId < targetId ? `${sourceId}:${targetId}` : `${targetId}:${sourceId}`
    if (!edgeDedup.has(key)) {
      edgeDedup.set(key, {
        id: edge.id,
        source: sourceId,
        target: targetId,
        sourceType: edge.sourceType,
        targetType: edge.targetType,
        metadata: edge.metadata,
        ...(edge.edgeType ? { edgeType: edge.edgeType } : {}),
      })
    }
  }

  return { nodes, edges: Array.from(edgeDedup.values()) }
}

export interface UseForceSimulationResult {
  nodes: SimulationNode[]
  edges: SimulationEdge[]
  tick: number
  isSimulating: boolean
  expandCategory: (cat: GraphCategory) => void
  collapseCategory: (cat: GraphCategory) => void
  expandAll: () => void
  collapseAll: () => void
  expandCompany: (companyId: string) => void
  pinNode: (nodeId: string, x: number, y: number) => void
  unpinNode: (nodeId: string) => void
}

export function useForceSimulation(
  data: GraphData | null,
  width: number,
  height: number,
): UseForceSimulationResult {
  const [expandedCategories, setExpandedCategories] = useState<Set<GraphCategory>>(
    () => new Set(),
  )
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    () => new Set(),
  )
  const [tick, setTick] = useState(0)
  const [isSimulating, setIsSimulating] = useState(false)

  const simulationRef = useRef<Simulation<SimulationNode, SimulationEdge> | null>(null)
  const nodesRef = useRef<SimulationNode[]>([])
  const edgesRef = useRef<SimulationEdge[]>([])

  // Build the graph whenever data or expanded categories change
  const graph = useMemo(() => {
    if (!data || width === 0 || height === 0) return null
    return buildGraph(data, expandedCategories, expandedCompanies, width, height)
  }, [data, expandedCategories, expandedCompanies, width, height])

  // Run simulation
  useEffect(() => {
    if (!graph) return

    // Stop any existing simulation
    simulationRef.current?.stop()

    const { nodes, edges } = graph
    nodesRef.current = nodes
    edgesRef.current = edges

    const cx = width / 2
    const cy = height / 2

    const simulation = forceSimulation<SimulationNode>(nodes)
      .alphaDecay(0.02)
      .velocityDecay(0.4)
      .force(
        'link',
        forceLink<SimulationNode, SimulationEdge>(edges)
          .id((d) => d.id)
          .distance((d) => d.edgeType === 'hierarchy' ? 70 : 140)
          .strength((d) => d.edgeType === 'hierarchy' ? 0.4 : 0.2),
      )
      .force('charge', forceManyBody<SimulationNode>().strength(-120).distanceMax(500))
      .force('center', forceCenter<SimulationNode>(cx, cy).strength(0.03))
      .force(
        'collide',
        forceCollide<SimulationNode>((d) => d.radius + 6),
      )
      .force(
        'x',
        forceX<SimulationNode>((d) => cx + CATEGORY_CENTROIDS[d.category].x).strength(0.03),
      )
      .force(
        'y',
        forceY<SimulationNode>((d) => cy + CATEGORY_CENTROIDS[d.category].y).strength(0.03),
      )
      .on('tick', () => {
        setTick((t) => t + 1)
      })
      .on('end', () => {
        setIsSimulating(false)
      })

    simulationRef.current = simulation
    setIsSimulating(true)

    return () => {
      simulation.stop()
    }
  }, [graph, width, height])

  const expandCategory = useCallback((cat: GraphCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      next.add(cat)
      return next
    })
  }, [])

  const collapseCategory = useCallback((cat: GraphCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      next.delete(cat)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    const allCats: GraphCategory[] = [
      'customer',
      'issue',
      'session',
      'knowledge_source',
      'product_scope',
    ]
    setExpandedCategories(new Set(allCats))
  }, [])

  const collapseAll = useCallback(() => {
    setExpandedCategories((prev) => prev.size === 0 ? prev : new Set())
    setExpandedCompanies((prev) => prev.size === 0 ? prev : new Set())
  }, [])

  const expandCompany = useCallback((companyId: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev)
      next.add(companyId)
      return next
    })
  }, [])

  const pinNode = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodesRef.current.find((n) => n.id === nodeId)
    if (!node) return
    node.fx = x
    node.fy = y
    simulationRef.current?.alpha(0.1).restart()
    setIsSimulating(true)
  }, [])

  const unpinNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((n) => n.id === nodeId)
    if (!node) return
    node.fx = null
    node.fy = null
    simulationRef.current?.alpha(0.1).restart()
    setIsSimulating(true)
  }, [])

  return {
    nodes: nodesRef.current,
    edges: edgesRef.current,
    tick,
    isSimulating,
    expandCategory,
    collapseCategory,
    expandAll,
    collapseAll,
    expandCompany,
    pinNode,
    unpinNode,
  }
}
