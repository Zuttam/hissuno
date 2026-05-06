import type { TagColorVariant } from '@/types/session'

/**
 * Product scope type discriminator
 */
export type ProductScopeType = 'product_area' | 'initiative' | 'experiment'

/**
 * A single free-text goal attached to a product scope
 */
export interface ProductScopeGoal {
  id: string
  text: string
}

/**
 * Product scope record from the database
 */
export interface ProductScopeRecord {
  id: string
  project_id: string
  parent_id: string | null
  name: string
  slug: string
  description: string
  color: TagColorVariant
  position: number
  depth: number
  is_default: boolean
  type: ProductScopeType
  goals: ProductScopeGoal[] | null
  custom_fields?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/**
 * Product scope with children for tree rendering
 */
export interface ProductScopeTreeNode extends ProductScopeRecord {
  children: ProductScopeTreeNode[]
}
