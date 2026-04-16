import type { EntityType } from '@/lib/db/queries/types'

export type GraphCategory = 'customer' | 'issue' | 'session' | 'knowledge_source' | 'product_scope'

export function entityTypeToCategory(type: EntityType): GraphCategory {
  if (type === 'company' || type === 'contact') return 'customer'
  return type as GraphCategory
}

export interface GraphNode {
  id: string
  type: EntityType
  category: GraphCategory
  label: string
  sublabel?: string
  parentId?: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  sourceType: EntityType
  targetType: EntityType
  metadata: Record<string, unknown> | null
  edgeType?: 'entity' | 'hierarchy'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface SimulationNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
  fx: number | null
  fy: number | null
  radius: number
  connectionCount: number
  isGroup: boolean
  groupCount: number
  groupEntityIds?: string[]
}

export interface SimulationEdge {
  id: string
  source: SimulationNode | string
  target: SimulationNode | string
  sourceType: EntityType
  targetType: EntityType
  metadata: Record<string, unknown> | null
  edgeType?: 'entity' | 'hierarchy'
}

export const CATEGORY_HEX: Record<GraphCategory, string> = {
  customer: '#3b82f6',
  issue: '#ef4444',
  session: '#6b7280',
  knowledge_source: '#f59e0b',
  product_scope: '#a78bfa',
}

export const CATEGORY_LABELS: Record<GraphCategory, string> = {
  customer: 'Customers',
  issue: 'Issues',
  session: 'Feedback',
  knowledge_source: 'Knowledge',
  product_scope: 'Scopes',
}

export const GROUP_THRESHOLD = 25

export function nodeRadius(connectionCount: number, isGroup: boolean): number {
  if (isGroup) return 20
  return 6 + Math.min(10, Math.sqrt(connectionCount) * 2)
}
