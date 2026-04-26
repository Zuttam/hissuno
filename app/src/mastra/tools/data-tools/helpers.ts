/**
 * Shared helpers for data-access tools.
 *
 * Extracts projectId and contactId from Mastra RuntimeContext so each
 * tool doesn't repeat the same defensive parsing logic.
 */

export interface DataContext {
  projectId: string | null
  contactId: string | null
}

/**
 * Extract projectId and contactId from requestContext with validation.
 * Same pattern as getContextFromRuntime() in analysis-knowledge-tools.ts.
 */
export function getDataContext(requestContext: unknown): DataContext {
  if (!requestContext || typeof requestContext !== 'object') {
    return { projectId: null, contactId: null }
  }
  const ctx = requestContext as { get?: (key: string) => unknown }
  if (typeof ctx.get !== 'function') {
    return { projectId: null, contactId: null }
  }
  const projectId = ctx.get('projectId')
  const contactId = ctx.get('contactId')
  return {
    projectId: typeof projectId === 'string' ? projectId : null,
    contactId: typeof contactId === 'string' ? contactId : null,
  }
}
