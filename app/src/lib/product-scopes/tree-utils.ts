/**
 * Tree utilities for hierarchical product scopes.
 */

import type { ProductScopeRecord, ProductScopeTreeNode } from '@/types/product-scope'

/**
 * Build a tree from a flat array of scopes.
 * Scopes with invalid parent_id (not in the array) become roots.
 */
export function buildScopeTree(scopes: ProductScopeRecord[]): ProductScopeTreeNode[] {
  const map = new Map<string, ProductScopeTreeNode>()
  const roots: ProductScopeTreeNode[] = []

  for (const scope of scopes) {
    map.set(scope.id, { ...scope, children: [] })
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortByPosition = (a: ProductScopeTreeNode, b: ProductScopeTreeNode) =>
    a.position - b.position

  for (const node of map.values()) {
    node.children.sort(sortByPosition)
  }
  roots.sort(sortByPosition)

  return roots
}

/**
 * Get all descendant IDs of a scope (recursive).
 * Used for cycle detection when reparenting.
 */
export function getScopeDescendantIds(
  scopes: ProductScopeRecord[],
  scopeId: string,
): string[] {
  const childrenMap = new Map<string, ProductScopeRecord[]>()
  for (const scope of scopes) {
    const parentKey = scope.parent_id ?? '__root__'
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, [])
    childrenMap.get(parentKey)!.push(scope)
  }

  const descendants: string[] = []
  const stack = [scopeId]
  while (stack.length > 0) {
    const current = stack.pop()!
    const children = childrenMap.get(current) ?? []
    for (const child of children) {
      descendants.push(child.id)
      stack.push(child.id)
    }
  }
  return descendants
}

/**
 * Compute depth by walking the parent chain.
 * Returns 0 for root scopes.
 */
export function computeDepth(
  scopes: ProductScopeRecord[],
  scopeId: string,
): number {
  const scopeMap = new Map(scopes.map(s => [s.id, s]))
  let depth = 0
  let current = scopeMap.get(scopeId)
  while (current?.parent_id) {
    depth++
    current = scopeMap.get(current.parent_id)
    if (!current) break
  }
  return depth
}
