/**
 * Knowledge Loader
 *
 * Loads analyzed source content for system prompt injection into the support agent.
 * Used by the widget chat route to inject knowledge directly into the system prompt
 * instead of using knowledge tools.
 */

import { db } from '@/lib/db'
import { supportPackages, supportPackageSources, knowledgeSources } from '@/lib/db/schema/app'
import { eq, and, inArray } from 'drizzle-orm'

/**
 * Load all analyzed knowledge for a package.
 *
 * Reads compiled content directly from the supportPackages record
 * (faq_content, howto_content, feature_docs_content, troubleshooting_content).
 * If no compiled content exists, falls back to concatenating each source's
 * analyzed_content via supportPackageSources.
 *
 * @returns Combined knowledge content string, or empty string if no content available
 */
export async function loadPackageKnowledge(packageId: string, projectId?: string): Promise<string> {
  // Fetch the package record with compiled content, scoped to project when provided
  const conditions = projectId
    ? and(eq(supportPackages.id, packageId), eq(supportPackages.project_id, projectId))
    : eq(supportPackages.id, packageId)

  const [pkg] = await db
    .select()
    .from(supportPackages)
    .where(conditions)
    .limit(1)

  if (!pkg) {
    console.log('[knowledge-loader] Package not found', packageId)
    return ''
  }

  // If compiled content exists, use structured sections
  if (pkg.compiled_at) {
    const sections: string[] = []

    if (pkg.faq_content) {
      sections.push(`## Frequently Asked Questions\n\n${pkg.faq_content}`)
    }
    if (pkg.howto_content) {
      sections.push(`## How-To Guides\n\n${pkg.howto_content}`)
    }
    if (pkg.feature_docs_content) {
      sections.push(`## Feature Documentation\n\n${pkg.feature_docs_content}`)
    }
    if (pkg.troubleshooting_content) {
      sections.push(`## Troubleshooting\n\n${pkg.troubleshooting_content}`)
    }

    if (sections.length > 0) {
      return sections.join('\n\n---\n\n')
    }
  }

  // Fall back to concatenating source analyzed_content
  const packageSourceRows = await db
    .select({ source_id: supportPackageSources.source_id })
    .from(supportPackageSources)
    .where(eq(supportPackageSources.package_id, packageId))

  if (packageSourceRows.length === 0) {
    console.log('[knowledge-loader] No sources linked to package', packageId)
    return ''
  }

  const sourceIds = packageSourceRows.map((s) => s.source_id)

  const sources = await db
    .select({
      id: knowledgeSources.id,
      name: knowledgeSources.name,
      type: knowledgeSources.type,
      analyzed_content: knowledgeSources.analyzed_content,
      status: knowledgeSources.status,
    })
    .from(knowledgeSources)
    .where(
      and(
        inArray(knowledgeSources.id, sourceIds),
        eq(knowledgeSources.status, 'done')
      )
    )

  if (sources.length === 0) {
    console.log('[knowledge-loader] No analyzed sources found for package', packageId)
    return ''
  }

  const sections: string[] = []

  for (const source of sources) {
    if (!source.analyzed_content) continue
    const sourceName = source.name || `${source.type} source`
    sections.push(`### ${sourceName}\n\n${source.analyzed_content}`)
  }

  if (sections.length === 0) {
    return ''
  }

  return sections.join('\n\n---\n\n')
}
