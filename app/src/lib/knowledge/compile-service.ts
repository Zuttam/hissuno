/**
 * Knowledge Package Compile Service
 *
 * Compiles analyzed source content into a structured support package with
 * categorized sections (FAQ, how-to, feature docs, troubleshooting).
 */

import { db } from '@/lib/db'
import { knowledgePackages, knowledgePackageSources, knowledgeSources } from '@/lib/db/schema/app'
import { eq, and, inArray } from 'drizzle-orm'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

const compilationSchema = z.object({
  faq_content: z.string().nullable().describe('Frequently asked questions and their answers, formatted as Q&A pairs in markdown'),
  howto_content: z.string().nullable().describe('Step-by-step how-to guides for common tasks, formatted in markdown'),
  feature_docs_content: z.string().nullable().describe('Feature documentation describing what the product does, formatted in markdown'),
  troubleshooting_content: z.string().nullable().describe('Common issues and their solutions, formatted in markdown'),
})

/**
 * Compile analyzed source content into a structured knowledge package.
 *
 * Flow:
 * 1. Verify package belongs to project
 * 2. Fetch linked sources with status='done' and their analyzed_content
 * 3. Use AI to categorize content into 4 sections
 * 4. Update the knowledgePackages record with compiled content fields
 */
export async function compilePackageContent(
  projectId: string,
  packageId: string,
): Promise<{
  faq_content: string | null
  howto_content: string | null
  feature_docs_content: string | null
  troubleshooting_content: string | null
  compiled_at: Date
  source_snapshot: Record<string, unknown>
}> {
  // Verify package belongs to project
  const [pkg] = await db
    .select({ id: knowledgePackages.id, guidelines: knowledgePackages.guidelines })
    .from(knowledgePackages)
    .where(
      and(
        eq(knowledgePackages.id, packageId),
        eq(knowledgePackages.project_id, projectId),
      )
    )
    .limit(1)

  if (!pkg) {
    throw new Error('Package not found or does not belong to this project.')
  }

  // Fetch linked source IDs
  const packageSourceRows = await db
    .select({ source_id: knowledgePackageSources.source_id })
    .from(knowledgePackageSources)
    .where(eq(knowledgePackageSources.package_id, packageId))

  if (packageSourceRows.length === 0) {
    throw new Error('No sources linked to this package.')
  }

  const sourceIds = packageSourceRows.map((s) => s.source_id)

  // Fetch sources with analyzed content
  const sources = await db
    .select({
      id: knowledgeSources.id,
      name: knowledgeSources.name,
      type: knowledgeSources.type,
      analyzed_content: knowledgeSources.analyzed_content,
    })
    .from(knowledgeSources)
    .where(
      and(
        inArray(knowledgeSources.id, sourceIds),
        eq(knowledgeSources.status, 'done'),
      )
    )

  const analyzedSources = sources.filter((s) => s.analyzed_content)

  if (analyzedSources.length === 0) {
    throw new Error('No analyzed sources available. Run source analysis first.')
  }

  // Concatenate source content for AI input
  const combinedContent = analyzedSources
    .map((s) => {
      const label = s.name || `${s.type} source`
      return `--- Source: ${label} ---\n\n${s.analyzed_content}`
    })
    .join('\n\n')

  // Use AI to categorize into structured sections
  const guidelinesSection = pkg.guidelines
    ? `\n\nThe package author provided these guidelines for how content should be organized:\n${pkg.guidelines}`
    : ''

  const { object: categorized } = await generateObject({
    model: openai('gpt-5.4'),
    schema: compilationSchema,
    prompt: `You are a technical writer organizing product knowledge into a structured support package.

Given the following analyzed source content from a product's codebase, documentation, and other sources, categorize the information into four sections:

1. **FAQ** - Frequently asked questions and clear answers. Extract questions users would commonly ask.
2. **How-To Guides** - Step-by-step instructions for accomplishing common tasks.
3. **Feature Documentation** - Descriptions of what the product does, its capabilities, and how features work.
4. **Troubleshooting** - Common problems, error messages, and their solutions.

Format each section in clean markdown. If a category has no relevant content, return null for that field.
Preserve technical accuracy. Do not invent information not present in the sources.${guidelinesSection}

--- SOURCE CONTENT ---

${combinedContent}`,
  })

  // Build source snapshot
  const sourceSnapshot = {
    sourceIds: analyzedSources.map((s) => s.id),
    sourceCount: analyzedSources.length,
  }

  const compiledAt = new Date()

  // Update the package record directly with compiled content
  const [updated] = await db
    .update(knowledgePackages)
    .set({
      faq_content: categorized.faq_content,
      howto_content: categorized.howto_content,
      feature_docs_content: categorized.feature_docs_content,
      troubleshooting_content: categorized.troubleshooting_content,
      compiled_at: compiledAt,
      source_snapshot: sourceSnapshot,
      updated_at: new Date(),
    })
    .where(eq(knowledgePackages.id, packageId))
    .returning()

  if (!updated) {
    throw new Error('Failed to save compilation.')
  }

  console.log(`[compile-service] Compiled package ${packageId}`)

  return {
    faq_content: categorized.faq_content,
    howto_content: categorized.howto_content,
    feature_docs_content: categorized.feature_docs_content,
    troubleshooting_content: categorized.troubleshooting_content,
    compiled_at: compiledAt,
    source_snapshot: sourceSnapshot,
  }
}
