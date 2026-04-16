/**
 * Package Compilation Workflow
 *
 * This workflow delegates to the per-source analysis workflow, then compiles
 * the analyzed content into a structured support package.
 *
 * Steps:
 * 1. Compile Package - For each source: fetch, sanitize, save, embed; then compile
 */

import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { workflowInputSchema } from './schemas'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { knowledgeSources } from '@/lib/db/schema/app'

const compileOutputSchema = z.object({
  projectId: z.string(),
  packageId: z.string().nullable(),
  sourcesProcessed: z.number(),
  errors: z.array(z.string()),
  compiled: z.boolean(),
  compilationError: z.string().nullable(),
})

/**
 * Single step that processes all sources sequentially, then compiles the package.
 * Each source goes through: fetch -> sanitize -> save+embed
 * After all sources complete, the package is compiled if packageId is provided.
 */
const compilePackage = createStep({
  id: 'compile-package',
  description: 'Analyze each source independently, then compile the package',
  inputSchema: workflowInputSchema,
  outputSchema: compileOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { projectId, packageId, sources } = inputData
    const logger = mastra?.getLogger()
    const errors: string[] = []
    let processedCount = 0

    await writer?.write({ type: 'progress', message: `Analyzing ${sources.length} source(s)...` })

    const { analyzeSource } = await import('@/lib/knowledge/knowledge-service')

    for (const source of sources) {
      try {
        await writer?.write({
          type: 'progress',
          message: `Analyzing source ${processedCount + 1}/${sources.length}: ${source.type}`,
        })

        const result = await analyzeSource({
          projectId,
          sourceId: source.id,
          sourceType: source.type as 'website' | 'docs_portal' | 'uploaded_doc' | 'raw_text' | 'codebase' | 'notion',
          url: source.url ?? null,
          storagePath: source.storagePath ?? null,
          content: source.content ?? null,
          analysisScope: null,
        })

        if (!result.saved || result.errors.length > 0) {
          errors.push(`${source.type} (${source.id}): ${result.errors.join(', ') || 'Save failed'}`)
        }

        processedCount++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${source.type} (${source.id}): ${message}`)
        logger?.error(`[compile-package] Error processing source ${source.id}:`, { error: message })

        // Mark source as failed
        await db
          .update(knowledgeSources)
          .set({ status: 'failed', error_message: message })
          .where(eq(knowledgeSources.id, source.id))
      }
    }

    await writer?.write({
      type: 'progress',
      message: `Completed: ${processedCount}/${sources.length} sources analyzed`,
    })

    // Compile the package if packageId is provided
    let compiled = false
    let compilationError: string | null = null

    if (packageId) {
      try {
        await writer?.write({ type: 'progress', message: 'Compiling package...' })

        const { compilePackageContent } = await import('@/lib/knowledge/compile-service')
        await compilePackageContent(projectId, packageId)

        compiled = true
        await writer?.write({ type: 'progress', message: 'Package compiled successfully' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown compilation error'
        compilationError = message
        logger?.error(`[compile-package] Compilation error for package ${packageId}:`, { error: message })
        await writer?.write({ type: 'progress', message: `Compilation failed: ${message}` })
      }
    }

    return {
      projectId,
      packageId,
      sourcesProcessed: processedCount,
      errors,
      compiled,
      compilationError,
    }
  },
})

export const packageCompilationWorkflow = createWorkflow({
  id: 'package-compilation-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: compileOutputSchema,
})
  .then(compilePackage)

packageCompilationWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
