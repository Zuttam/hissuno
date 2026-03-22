import type { GraphEntityType } from '@/mastra/workflows/graph-evaluation'

/** Fire-and-forget: trigger graph evaluation for an entity. Non-blocking, never throws. */
export function fireGraphEval(projectId: string, entityType: GraphEntityType, entityId: string) {
  void (async () => {
    try {
      const { triggerGraphEvaluation } = await import('@/mastra/workflows/graph-evaluation')
      const { mastra } = await import('@/mastra')
      void triggerGraphEvaluation(mastra, { projectId, entityType, entityId })
    } catch {
      // Non-blocking
    }
  })()
}
