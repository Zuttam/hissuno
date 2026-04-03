import type { GraphEntityType, CreationContext } from '@/mastra/workflows/graph-evaluation'

/** Fire-and-forget: trigger graph evaluation for an entity. Non-blocking, never throws. */
export function fireGraphEval(
  projectId: string,
  entityType: GraphEntityType,
  entityId: string,
  creationContext?: CreationContext,
) {
  void (async () => {
    try {
      const { evaluateEntityRelationships } = await import('@/mastra/workflows/graph-evaluation')
      await evaluateEntityRelationships(projectId, entityType, entityId, creationContext)
    } catch {
      // Non-blocking
    }
  })()
}
