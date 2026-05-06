import type { ProductScopeRecord } from '@/types/product-scope'

/**
 * Builds a markdown prompt section describing available product scopes.
 */
export function buildProductScopePromptSection(
  scopes: ProductScopeRecord[],
  entityNoun: string,
): string {
  if (scopes.length === 0) {
    return ''
  }

  // Build a parent-id lookup so we can group children under parents
  const parentMap = new Map<string | null, ProductScopeRecord[]>()
  for (const scope of scopes) {
    const key = scope.parent_id
    if (!parentMap.has(key)) parentMap.set(key, [])
    parentMap.get(key)!.push(scope)
  }

  // Recursively flatten scopes in tree order
  function flattenScopes(parentId: string | null): ProductScopeRecord[] {
    const children = parentMap.get(parentId) ?? []
    const result: ProductScopeRecord[] = []
    for (const child of children) {
      result.push(child)
      result.push(...flattenScopes(child.id))
    }
    return result
  }

  const orderedScopes = flattenScopes(null)
  // Include any scopes whose parent isn't in the list (orphans)
  const orderedIds = new Set(orderedScopes.map((s) => s.id))
  for (const scope of scopes) {
    if (!orderedIds.has(scope.id)) orderedScopes.push(scope)
  }

  const scopeRows = orderedScopes
    .map((scope) => {
      const typeLabel =
        scope.type === 'initiative'
          ? 'Initiative'
          : scope.type === 'experiment'
            ? 'Experiment'
            : 'Product Area'
      const indent = scope.parent_id ? '  - ' : ''
      return `| ${indent}${scope.slug} | ${scope.name} | ${typeLabel} | ${scope.description} |${scope.is_default ? ' (default)' : ''}`
    })
    .join('\n')

  // Build goals section if any scope has goals
  const scopesWithGoals = scopes.filter((s) => s.goals && s.goals.length > 0)
  let goalsSection = ''
  if (scopesWithGoals.length > 0) {
    const goalLines = scopesWithGoals
      .map((scope) => {
        const goalList = scope.goals!
          .map((g) => `  - ${g.text}`)
          .join('\n')
        return `**${scope.name}** (${scope.slug}):\n${goalList}`
      })
      .join('\n\n')

    goalsSection = `
### Goals

The following product scopes have business goals. When analyzing the ${entityNoun}, consider how it aligns with these goals and include goal alignment information in your response.

${goalLines}

`
  }

  return `
## Product Scopes

Assign the ${entityNoun} to the most relevant product scope. Use the slug value.
If no specific scope matches, use "default".

| Slug | Name | Type | Description |
|------|------|------|-------------|
${scopeRows}

${goalsSection}`
}

/**
 * Builds a Map from product scope slug to ID and resolves a slug to its ID.
 */
export function resolveProductScopeId(
  scopes: ProductScopeRecord[],
  slug: string | null | undefined,
): string | null {
  if (!slug) return null
  const match = scopes.find((s) => s.slug === slug)
  return match?.id ?? null
}
