/**
 * Knowledge Resource Adapter
 *
 * Provides access to analyzed knowledge sources.
 * Knowledge can be listed, fetched, and searched but not created via MCP
 * (requires the async analysis pipeline via the dashboard).
 */

import { db } from '@/lib/db'
import { eq, and, desc, ilike, or } from 'drizzle-orm'
import { knowledgeSources } from '@/lib/db/schema/app'
import { searchKnowledgeBySourceIds } from '@/lib/knowledge/embedding-service'
import type { ResourceAdapter, ResourceListItem, ResourceDetail, SearchResult, AddResult } from './types'

const LOG_PREFIX = '[mcp.resources.knowledge]'

export const knowledgeAdapter: ResourceAdapter = {
  async list(projectId, filters) {
    const limit = typeof filters.limit === 'number' ? filters.limit : 20

    const data = await db
      .select({
        id: knowledgeSources.id,
        type: knowledgeSources.type,
        name: knowledgeSources.name,
        description: knowledgeSources.description,
        analyzed_at: knowledgeSources.analyzed_at,
      })
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.project_id, projectId),
          eq(knowledgeSources.status, 'done')
        )
      )
      .orderBy(desc(knowledgeSources.created_at))
      .limit(limit)

    const items: ResourceListItem[] = data.map((s) => ({
      id: s.id,
      name: s.name ?? 'Untitled',
      description: s.description ?? '',
      metadata: {
        type: s.type,
        ...(s.analyzed_at ? { analyzedAt: s.analyzed_at.toISOString() } : {}),
      },
    }))

    return { items, total: items.length }
  },

  async get(projectId, id) {
    const [source] = await db
      .select({
        id: knowledgeSources.id,
        name: knowledgeSources.name,
        type: knowledgeSources.type,
        description: knowledgeSources.description,
        analyzed_content: knowledgeSources.analyzed_content,
        analyzed_at: knowledgeSources.analyzed_at,
        status: knowledgeSources.status,
      })
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, id),
          eq(knowledgeSources.project_id, projectId)
        )
      )

    if (!source) {
      return null
    }

    if (source.status !== 'done' || !source.analyzed_content) {
      return null
    }

    const content = source.analyzed_content
    if (!content) {
      throw new Error('Analyzed content is empty')
    }

    const header = [
      `# ${source.name ?? 'Knowledge Source'}`,
      '',
      `- **Type:** ${source.type}`,
      source.description ? `- **Description:** ${source.description}` : null,
      source.analyzed_at ? `- **Analyzed:** ${source.analyzed_at.toISOString()}` : null,
      '',
      '---',
      '',
    ]
      .filter((line) => line !== null)
      .join('\n')

    return {
      id: source.id,
      type: 'knowledge' as const,
      markdown: header + content,
    }
  },

  async search(projectId, query, limit) {
    // Phase 1: Try semantic vector search
    try {
      const results = await searchKnowledgeBySourceIds(projectId, query, {
        limit,
        similarityThreshold: 0.5,
      })

      if (results.length > 0) {
        return results.map(
          (r): SearchResult => ({
            id: r.id,
            type: 'knowledge',
            name: r.sectionHeading ?? 'Knowledge chunk',
            snippet: r.chunkText.slice(0, 200),
            score: r.similarity,
          })
        )
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} semantic search failed, falling back to text`, err)
    }

    // Phase 2: Fall back to ILIKE text search on knowledge source name/content
    const s = `%${query}%`
    const data = await db
      .select({
        id: knowledgeSources.id,
        name: knowledgeSources.name,
        analyzed_content: knowledgeSources.analyzed_content,
      })
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.project_id, projectId),
          eq(knowledgeSources.status, 'done'),
          eq(knowledgeSources.enabled, true),
          or(
            ilike(knowledgeSources.name, s),
            ilike(knowledgeSources.analyzed_content, s)
          )
        )
      )
      .orderBy(desc(knowledgeSources.created_at))
      .limit(limit)

    return data.map(
      (r): SearchResult => ({
        id: r.id,
        type: 'knowledge',
        name: r.name ?? 'Knowledge source',
        snippet: (r.analyzed_content ?? '').slice(0, 200),
        score: 0,
      })
    )
  },

  async add(): Promise<AddResult> {
    throw new Error('Knowledge sources cannot be created via MCP. Use the dashboard to add and analyze knowledge sources.')
  },
}
