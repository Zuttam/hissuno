/**
 * Step 5: Save Knowledge Packages
 *
 * Saves sanitized knowledge to Supabase Storage and updates the database
 * with package metadata, including redaction summary from security scanning.
 */

import { createStep } from '@mastra/core/workflows'
import { sanitizedKnowledgeSchema, workflowOutputSchema, type KnowledgePackage } from '../schemas'

export const saveKnowledgePackages = createStep({
  id: 'save-knowledge-packages',
  description: 'Save compiled knowledge to storage and update database',
  inputSchema: sanitizedKnowledgeSchema,
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData, getInitData, writer }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    await writer?.write({ type: 'progress', message: 'Saving knowledge packages...' })

    const { business, product, technical, redactionSummary } = inputData
    const initData = getInitData?.() as { 
      projectId: string
      analysisId?: string
      sources: unknown[] 
    } | undefined
    const projectId = initData?.projectId
    const analysisId = initData?.analysisId

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
        await writer?.write({ type: 'progress', message: `Saving ${key} knowledge package...` })
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

      // Update project_analyses record to mark completion
      if (analysisId) {
        const analysisStatus = packages.length > 0 ? 'completed' : 'failed'
        const { error: analysisUpdateError } = await supabase
          .from('project_analyses')
          .update({
            status: analysisStatus,
            completed_at: new Date().toISOString(),
            error_message: errors.length > 0 ? errors.join('; ') : null,
            metadata: {
              packagesCount: packages.length,
              sourcesCount: sourceIds.length,
              errors: errors.length > 0 ? errors : undefined,
              redactionSummary: redactionSummary.totalRedactions > 0 ? redactionSummary : undefined,
            },
          })
          .eq('id', analysisId)

        if (analysisUpdateError) {
          console.error('[save-packages] Failed to update analysis record:', analysisUpdateError)
        } else {
          console.log('[save-packages] Updated analysis record:', analysisId, 'status:', analysisStatus)
        }
      }

      await writer?.write({ 
        type: 'progress', 
        message: `Analysis complete! Saved ${packages.length} knowledge packages.` 
      })

      return {
        saved: packages.length > 0,
        packages,
        errors,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      // Mark analysis as failed if we have an analysisId
      if (analysisId) {
        try {
          const { createAdminClient } = await import('@/lib/supabase/server')
          const supabase = createAdminClient()
          await supabase
            .from('project_analyses')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: message,
            })
            .eq('id', analysisId)
        } catch (updateError) {
          console.error('[save-packages] Failed to mark analysis as failed:', updateError)
        }
      }
      
      return {
        saved: false,
        packages: [],
        errors: [`Failed to save packages: ${message}`],
      }
    }
  },
})
