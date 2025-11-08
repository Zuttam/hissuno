/**
 * Step 4: Save Knowledge Packages
 *
 * Saves compiled knowledge to Supabase Storage and updates the database
 * with package metadata.
 */

import { createStep } from '@mastra/core/workflows'
import { compiledKnowledgeSchema, workflowOutputSchema, type KnowledgePackage } from '../schemas'

export const saveKnowledgePackages = createStep({
  id: 'save-knowledge-packages',
  description: 'Save compiled knowledge to storage and update database',
  inputSchema: compiledKnowledgeSchema,
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData, getInitData }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { business, product, technical } = inputData
    const initData = getInitData?.() as { projectId: string; sources: unknown[] } | undefined
    const projectId = initData?.projectId

    if (!projectId) {
      return {
        saved: false,
        packages: [],
        errors: ['Project ID not found in workflow context'],
      }
    }

    const packages: KnowledgePackage[] = []
    const errors: string[] = []

    // Dynamic imports to avoid issues in workflow context
    try {
      const { createAdminClient } = await import('@/lib/supabase/server')
      const { uploadKnowledgePackage } = await import('@/lib/knowledge/storage')
      const supabase = createAdminClient()

      const categories = [
        { key: 'business' as const, content: business },
        { key: 'product' as const, content: product },
        { key: 'technical' as const, content: technical },
      ]

      for (const { key, content } of categories) {
        try {
          // Get current version
          const { data: existing } = await supabase
            .from('knowledge_packages')
            .select('version')
            .eq('project_id', projectId)
            .eq('category', key)
            .single()

          const newVersion = (existing?.version ?? 0) + 1

          // Upload to storage using the helper (uses admin client internally)
          const { path: storagePath, error: uploadError } = await uploadKnowledgePackage(
            projectId,
            key,
            content,
            newVersion
          )

          if (uploadError) {
            errors.push(`Failed to upload ${key}: ${uploadError.message}`)
            continue
          }

          // Upsert database record
          const { error: dbError } = await supabase.from('knowledge_packages').upsert(
            {
              project_id: projectId,
              category: key,
              storage_path: storagePath,
              version: newVersion,
              generated_at: new Date().toISOString(),
            },
            {
              onConflict: 'project_id,category',
            }
          )

          if (dbError) {
            errors.push(`Failed to save ${key} record: ${dbError.message}`)
            continue
          }

          packages.push({
            category: key,
            path: storagePath,
            version: newVersion,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Error saving ${key}: ${message}`)
        }
      }

      // Update source statuses
      const sourceIds = (initData?.sources as Array<{ id: string }> | undefined)?.map((s) => s.id) ?? []
      if (sourceIds.length > 0) {
        await supabase
          .from('knowledge_sources')
          .update({
            status: errors.length > 0 ? 'failed' : 'completed',
            analyzed_at: new Date().toISOString(),
            error_message: errors.length > 0 ? errors.join('; ') : null,
          })
          .in('id', sourceIds)
      }

      return {
        saved: packages.length > 0,
        packages,
        errors,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        saved: false,
        packages: [],
        errors: [`Failed to save packages: ${message}`],
      }
    }
  },
})
