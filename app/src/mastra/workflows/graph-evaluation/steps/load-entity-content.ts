/**
 * Step 1: Load Entity Content
 *
 * Loads text content from the source entity based on entityType.
 * Also loads knowledge_relationship_guidelines from project settings.
 */

import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { sessions, issues, knowledgeSources, contacts, companies } from '@/lib/db/schema/app'
import { getKnowledgeAnalysisSettingsAdmin } from '@/lib/db/queries/project-settings/knowledge-analysis'
import type { GraphEntityType } from '../schemas'

/**
 * Core logic for loading entity content. Exported for inline use.
 */
export async function loadEntityContent(
  projectId: string,
  entityType: GraphEntityType,
  entityId: string,
): Promise<{
  contentForSearch: string
  contentForTextMatch: string
  entityName: string
  guidelines: string | null
}> {
  let contentForSearch = ''
  let contentForTextMatch = ''
  let entityName = ''

  switch (entityType) {
    case 'session': {
      const row = await db.query.sessions.findFirst({
        where: eq(sessions.id, entityId),
        columns: { name: true, description: true },
      })
      entityName = row?.name || 'Unnamed session'
      const text = [row?.name, row?.description].filter(Boolean).join('\n\n')
      contentForSearch = text.slice(0, 3000)
      contentForTextMatch = text
      break
    }
    case 'issue': {
      const row = await db.query.issues.findFirst({
        where: eq(issues.id, entityId),
        columns: { title: true, description: true },
      })
      entityName = row?.title || 'Unnamed issue'
      const text = [row?.title, row?.description].filter(Boolean).join('\n\n')
      contentForSearch = text.slice(0, 3000)
      contentForTextMatch = text
      break
    }
    case 'knowledge_source': {
      const row = await db.query.knowledgeSources.findFirst({
        where: eq(knowledgeSources.id, entityId),
        columns: { name: true, description: true, analyzed_content: true },
      })
      entityName = row?.name || 'Unnamed source'
      const text = row?.analyzed_content || row?.description || row?.name || ''
      contentForSearch = text.slice(0, 3000)
      contentForTextMatch = text
      break
    }
    case 'contact': {
      const row = await db.query.contacts.findFirst({
        where: eq(contacts.id, entityId),
        columns: { name: true, email: true, role: true, title: true, notes: true },
        with: { company: { columns: { name: true } } },
      })
      entityName = row?.name || 'Unknown contact'
      const { buildContactEmbeddingText } = await import('@/lib/customers/customer-embedding-service')
      const text = buildContactEmbeddingText({
        name: row?.name || '',
        email: row?.email || '',
        role: row?.role,
        title: row?.title,
        companyName: row?.company?.name,
        notes: row?.notes,
      })
      contentForSearch = text
      contentForTextMatch = text
      break
    }
    case 'company': {
      const row = await db.query.companies.findFirst({
        where: eq(companies.id, entityId),
        columns: { name: true, domain: true, industry: true, notes: true },
      })
      entityName = row?.name || 'Unknown company'
      const text = [row?.name, row?.domain, row?.industry, row?.notes].filter(Boolean).join(' ')
      contentForSearch = text.slice(0, 3000)
      contentForTextMatch = text
      break
    }
  }

  const settings = await getKnowledgeAnalysisSettingsAdmin(projectId)

  return {
    contentForSearch,
    contentForTextMatch,
    entityName,
    guidelines: settings.knowledge_relationship_guidelines,
  }
}

