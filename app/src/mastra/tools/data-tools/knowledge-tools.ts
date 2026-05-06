/**
 * Knowledge Tools
 *
 * Tools for the PM-mode chat agent to access project knowledge at the source
 * level - no package scoping.
 *
 * These tools expect `projectId` in the RuntimeContext.
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/lib/db'
import { eq, and, desc, isNotNull, inArray } from 'drizzle-orm'
import { knowledgeSources, productScopes, entityRelationships } from '@/lib/db/schema/app'
import { searchKnowledgeBySourceIds } from '@/lib/knowledge/embedding-service'

function getProjectId(requestContext: unknown): string | null {
  if (!requestContext || typeof requestContext !== 'object') return null
  const ctx = requestContext as { get?: (key: string) => unknown }
  if (typeof ctx.get !== 'function') return null
  const projectId = ctx.get('projectId')
  return typeof projectId === 'string' ? projectId : null
}

/**
 * List all analyzed knowledge sources for the project
 */
export const listKnowledgeItemsTool = createTool({
  id: 'list-knowledge-items',
  description: `List all analyzed knowledge sources for the current project.
Use this to understand what knowledge is available and decide which sources to load.
Returns source id, type, name, description, and analysis status.
The project is automatically determined from context.`,
  inputSchema: z.object({}),
  outputSchema: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        name: z.string().nullable(),
        description: z.string().nullable(),
        productScope: z.string().nullable(),
        analyzedAt: z.string().nullable(),
        relatedCompanyCount: z.number(),
        relatedIssueCount: z.number(),
        relatedSessionCount: z.number(),
      })
    ),
    error: z.string().optional(),
  }),
  execute: async (_, { requestContext }) => {
    const projectId = getProjectId(requestContext)
    if (!projectId) {
      return { items: [], error: 'Project context not available.' }
    }

    try {
      const sources = await db
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

      // Fetch product scope names via entity_relationships
      const sourceIds = sources.map((s) => s.id)
      const psRels = sourceIds.length > 0
        ? await db
            .select({
              knowledge_source_id: entityRelationships.knowledge_source_id,
              product_scope_id: entityRelationships.product_scope_id,
            })
            .from(entityRelationships)
            .where(and(
              eq(entityRelationships.project_id, projectId),
              inArray(entityRelationships.knowledge_source_id, sourceIds),
              isNotNull(entityRelationships.product_scope_id)
            ))
        : []

      // Build source -> product_scope_id map
      const sourcePsMap = new Map<string, string>()
      for (const rel of psRels) {
        if (rel.knowledge_source_id && rel.product_scope_id) {
          sourcePsMap.set(rel.knowledge_source_id, rel.product_scope_id)
        }
      }

      // Fetch product scope names
      const psIds = [...new Set(Array.from(sourcePsMap.values()))]
      const psMap = new Map<string, string>()
      if (psIds.length > 0) {
        const psRows = await db
          .select({ id: productScopes.id, name: productScopes.name })
          .from(productScopes)
          .where(inArray(productScopes.id, psIds))
        for (const ps of psRows) {
          psMap.set(ps.id, ps.name)
        }
      }

      // Batch-query relationship counts for all sources in a single query
      const countsMap = new Map<string, { relatedCompanyCount: number; relatedIssueCount: number; relatedSessionCount: number }>()
      if (sourceIds.length > 0) {
        const allRels = await db
          .select({
            knowledge_source_id: entityRelationships.knowledge_source_id,
            company_id: entityRelationships.company_id,
            issue_id: entityRelationships.issue_id,
            session_id: entityRelationships.session_id,
          })
          .from(entityRelationships)
          .where(and(
            eq(entityRelationships.project_id, projectId),
            inArray(entityRelationships.knowledge_source_id, sourceIds),
          ))

        for (const rel of allRels) {
          if (!rel.knowledge_source_id) continue
          let entry = countsMap.get(rel.knowledge_source_id)
          if (!entry) {
            entry = { relatedCompanyCount: 0, relatedIssueCount: 0, relatedSessionCount: 0 }
            countsMap.set(rel.knowledge_source_id, entry)
          }
          if (rel.company_id) entry.relatedCompanyCount++
          if (rel.issue_id) entry.relatedIssueCount++
          if (rel.session_id) entry.relatedSessionCount++
        }
      }

      return {
        items: sources.map((s) => {
          const counts = countsMap.get(s.id)
          const psId = sourcePsMap.get(s.id)
          return {
            id: s.id,
            type: s.type,
            name: s.name,
            description: s.description,
            productScope: psId ? (psMap.get(psId) ?? null) : null,
            analyzedAt: s.analyzed_at?.toISOString() ?? null,
            relatedCompanyCount: counts?.relatedCompanyCount ?? 0,
            relatedIssueCount: counts?.relatedIssueCount ?? 0,
            relatedSessionCount: counts?.relatedSessionCount ?? 0,
          }
        }),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { items: [], error: message }
    }
  },
})

/**
 * Get the full analyzed content for a specific source
 */
export const getKnowledgeContentTool = createTool({
  id: 'get-knowledge-content',
  description: `Get the full analyzed content of a specific knowledge source.
Use this after listing items to load the content of a relevant source.
Returns the complete analyzed markdown content.`,
  inputSchema: z.object({
    sourceId: z.string().describe('The ID of the knowledge source to load'),
  }),
  outputSchema: z.object({
    content: z.string(),
    found: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async (context, { requestContext }) => {
    const projectId = getProjectId(requestContext)
    if (!projectId) {
      return { content: '', found: false, error: 'Project context not available.' }
    }

    try {
      const [source] = await db
        .select({
          id: knowledgeSources.id,
          analyzed_content: knowledgeSources.analyzed_content,
          status: knowledgeSources.status,
        })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.id, context.sourceId),
            eq(knowledgeSources.project_id, projectId)
          )
        )

      if (!source) {
        return { content: '', found: false, error: 'Source not found.' }
      }

      if (source.status !== 'done' || !source.analyzed_content) {
        return { content: '', found: false, error: 'Source has not been analyzed yet.' }
      }

      return { content: source.analyzed_content, found: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { content: '', found: false, error: message }
    }
  },
})

/**
 * Get full metadata for a specific knowledge source
 */
export const getKnowledgeSourceDetailTool = createTool({
  id: 'get-knowledge-source-detail',
  description: `Get full metadata for a specific knowledge source.
Returns source details including name, type, status, url, description, analysis scope, enabled state, product scope, and timestamps.
Use this when you need source metadata rather than analyzed content.`,
  inputSchema: z.object({
    sourceId: z.string().describe('The ID of the knowledge source'),
  }),
  outputSchema: z.object({
    source: z.object({
      id: z.string(),
      type: z.string(),
      name: z.string().nullable(),
      description: z.string().nullable(),
      url: z.string().nullable(),
      status: z.string(),
      enabled: z.boolean(),
      analysisScope: z.string().nullable(),
      productScope: z.string().nullable(),
      analyzedAt: z.string().nullable(),
      createdAt: z.string().nullable(),
    }).nullable(),
    found: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async (context, { requestContext }) => {
    const projectId = getProjectId(requestContext)
    if (!projectId) {
      return { source: null, found: false, error: 'Project context not available.' }
    }

    try {
      const [source] = await db
        .select({
          id: knowledgeSources.id,
          type: knowledgeSources.type,
          name: knowledgeSources.name,
          description: knowledgeSources.description,
          url: knowledgeSources.url,
          status: knowledgeSources.status,
          enabled: knowledgeSources.enabled,
          analysis_scope: knowledgeSources.analysis_scope,
          analyzed_at: knowledgeSources.analyzed_at,
          created_at: knowledgeSources.created_at,
        })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.id, context.sourceId),
            eq(knowledgeSources.project_id, projectId)
          )
        )

      if (!source) {
        return { source: null, found: false, error: 'Source not found.' }
      }

      // Fetch product scope name via entity_relationships
      const [psRel] = await db
        .select({
          product_scope_id: entityRelationships.product_scope_id,
        })
        .from(entityRelationships)
        .where(and(
          eq(entityRelationships.project_id, projectId),
          eq(entityRelationships.knowledge_source_id, context.sourceId),
          isNotNull(entityRelationships.product_scope_id)
        ))
        .limit(1)

      let productScopeName: string | null = null
      if (psRel?.product_scope_id) {
        const [ps] = await db
          .select({ name: productScopes.name })
          .from(productScopes)
          .where(eq(productScopes.id, psRel.product_scope_id))
          .limit(1)
        productScopeName = ps?.name ?? null
      }

      return {
        source: {
          id: source.id,
          type: source.type,
          name: source.name,
          description: source.description,
          url: source.url,
          status: source.status,
          enabled: source.enabled ?? true,
          analysisScope: source.analysis_scope,
          productScope: productScopeName,
          analyzedAt: source.analyzed_at?.toISOString() ?? null,
          createdAt: source.created_at?.toISOString() ?? null,
        },
        found: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { source: null, found: false, error: message }
    }
  },
})

/**
 * Semantic search across all project knowledge
 */
export const semanticSearchKnowledgeTool = createTool({
  id: 'semantic-search-knowledge',
  description: `Search project knowledge using semantic similarity (AI-powered search).
Searches across ALL analyzed sources in the project.
Use this for natural language questions - it understands meaning, not just keywords.
The project is automatically determined from context.`,
  inputSchema: z.object({
    query: z.string().describe('Natural language question or search query'),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .optional()
      .describe('Maximum results to return (default: 5)'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        chunk: z.string(),
        sectionHeading: z.string().nullable(),
        parentContext: z.array(z.string()),
        similarity: z.number(),
        sourceId: z.string().nullable(),
      })
    ),
    totalResults: z.number(),
    error: z.string().optional(),
  }),
  execute: async (context, { requestContext }) => {
    const { query, limit = 5 } = context
    const projectId = getProjectId(requestContext)

    if (!projectId) {
      return { results: [], totalResults: 0, error: 'Project context not available.' }
    }

    try {
      const searchResults = await searchKnowledgeBySourceIds(projectId, query, {
        limit,
        similarityThreshold: 0.5,
      })

      const results = searchResults.map((result) => ({
        chunk: result.chunkText,
        sectionHeading: result.sectionHeading,
        parentContext: result.parentHeadings,
        similarity: Math.round(result.similarity * 100) / 100,
        sourceId: result.sourceId,
      }))

      return { results, totalResults: results.length }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { results: [], totalResults: 0, error: message }
    }
  },
})

/** All knowledge tools */
export const knowledgeTools = [
  listKnowledgeItemsTool,
  getKnowledgeContentTool,
  getKnowledgeSourceDetailTool,
  semanticSearchKnowledgeTool,
]
