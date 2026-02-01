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

    const { projectId, namedPackageId, business, product, technical, faq, how_to, redactionSummary, localCodePath, codebaseLeaseId, codebaseCommitSha } = inputData
    const initData = getInitData?.() as {
      projectId: string
      namedPackageId?: string
      analysisId?: string
      sources: unknown[]
    } | undefined
    // Use projectId from inputData first, fall back to initData
    const resolvedProjectId = projectId ?? initData?.projectId
    const resolvedNamedPackageId = namedPackageId ?? initData?.namedPackageId ?? null
    const analysisId = initData?.analysisId

    if (!resolvedProjectId) {
      return {
        projectId: '',
        namedPackageId: resolvedNamedPackageId,
        saved: false,
        packages: [],
        errors: ['Project ID not found in workflow context'],
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
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
        { key: 'faq' as const, content: faq },
        { key: 'how_to' as const, content: how_to },
      ]

      for (const { key, content } of categories) {
        await writer?.write({ type: 'progress', message: `Saving ${key} knowledge package...` })
        try {
          // Get current version - filter by named_package_id if provided
          let versionQuery = supabase
            .from('knowledge_packages')
            .select('version')
            .eq('project_id', resolvedProjectId)
            .eq('category', key)

          if (resolvedNamedPackageId) {
            versionQuery = versionQuery.eq('named_package_id', resolvedNamedPackageId)
          }

          const { data: existing } = await versionQuery.single()

          const newVersion = (existing?.version ?? 0) + 1

          // Upload to storage using the helper (uses admin client internally)
          // Include named package ID in path for organization
          const storageSuffix = resolvedNamedPackageId ? `/${resolvedNamedPackageId}` : ''
          const { path: storagePath, error: uploadError } = await uploadKnowledgePackage(
            `${resolvedProjectId}${storageSuffix}`,
            key,
            content,
            newVersion
          )

          if (uploadError) {
            errors.push(`Failed to upload ${key}: ${uploadError.message}`)
            continue
          }

          // Upsert database record with named_package_id
          const packageRecord: Record<string, unknown> = {
            project_id: resolvedProjectId,
            category: key,
            storage_path: storagePath,
            version: newVersion,
            generated_at: new Date().toISOString(),
            named_package_id: resolvedNamedPackageId,
          }

          // For upsert, we need to handle the conflict differently based on whether we have a named package
          // If we have a named_package_id, we need to match on project_id + category + named_package_id
          // If not, we match on project_id + category (legacy behavior)
          let upsertQuery
          if (resolvedNamedPackageId) {
            // Delete existing and insert new (since we can't use composite unique on nullable column easily)
            await supabase
              .from('knowledge_packages')
              .delete()
              .eq('project_id', resolvedProjectId)
              .eq('category', key)
              .eq('named_package_id', resolvedNamedPackageId)

            upsertQuery = supabase.from('knowledge_packages').insert(packageRecord)
          } else {
            upsertQuery = supabase.from('knowledge_packages').upsert(packageRecord, {
              onConflict: 'project_id,category',
            })
          }

          const { error: dbError } = await upsertQuery

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
        projectId: resolvedProjectId,
        namedPackageId: resolvedNamedPackageId,
        saved: packages.length > 0,
        packages,
        errors,
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
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
        projectId: resolvedProjectId ?? '',
        namedPackageId: resolvedNamedPackageId,
        saved: false,
        packages: [],
        errors: [`Failed to save packages: ${message}`],
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
      }
    }
  },
})
