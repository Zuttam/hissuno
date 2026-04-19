/**
 * Step 3: Discover Relationships
 *
 * Runs applicable discovery strategies based on entity type:
 * 1. Product scope text match (skip for contacts/companies)
 * 2. Semantic session search (skip if entityType=session)
 * 3. Semantic issue search (skip if entityType=issue)
 * 4. Semantic knowledge search (skip if entityType=knowledge_source)
 * 5. Semantic contact search (skip if entityType=contact)
 * 6. Semantic company search (skip for contacts, skip if entityType=company)
 * 7. Company text match fallback (skip for contacts, skip if entityType=company)
 *
 * Flow: search → batch LLM context enrichment → link
 *
 * Searches collect matches without linking. Then a single LLM call generates
 * human-readable context for all matches. Finally, all matches are linked
 * with enriched metadata. If the LLM call fails, template context is used.
 */

import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { productScopes, companies } from '@/lib/db/schema/app'
import { linkEntities, getRelatedIds } from '@/lib/db/queries/entity-relationships'
import { classifyGoal } from './classify-goal'
import { searchSessionsSemantic } from '@/lib/sessions/embedding-service'
import { searchSimilarIssues } from '@/lib/issues/embedding-service'
import { searchKnowledgeBySourceIds } from '@/lib/knowledge/embedding-service'
import { searchContactsSemantic, searchCompaniesSemantic } from '@/lib/customers/customer-embedding-service'
import {
  buildSemanticContext,
  buildTextMatchContext,
  buildProductScopeContext,
} from '@/lib/db/queries/relationship-metadata'
import { enrichRelationshipContext, type DiscoveredMatch } from './enrich-relationship-context'
import type { GraphEntityType } from '../schemas'
import type { GraphEvaluationConfig } from '../config'
import type { ProductScopeGoal } from '@/types/product-scope'

interface DiscoverInput {
  projectId: string
  entityType: GraphEntityType
  entityId: string
  topics: string[]
  combinedQuery: string
  contentForTextMatch: string
  entityName?: string
  contentForSearch?: string
  config: GraphEvaluationConfig
}

/**
 * Match an entity against product scopes using topic text matching + goal classification.
 * Returns the first matching scope or null.
 */
export async function matchProductScope(
  projectId: string,
  topics: string[],
  entityName: string,
  contentSnippet: string,
  options: { requireFullTopicMatch?: boolean; llmClassification?: boolean } = {},
): Promise<{
  scopeId: string
  scopeName: string
  reasoning: string | null
  matchedGoalId: string | null
  matchedGoalText: string | null
} | null> {
  const { requireFullTopicMatch = false, llmClassification = true } = options
  const scopes = await db
    .select({ id: productScopes.id, name: productScopes.name, description: productScopes.description, goals: productScopes.goals })
    .from(productScopes)
    .where(eq(productScopes.project_id, projectId))

  const topicsLower = topics.map(t => t.toLowerCase())
  for (const scope of scopes) {
    const scopeGoals = (scope.goals as ProductScopeGoal[]) ?? []
    const goalTexts = scopeGoals.map(g => g.text.toLowerCase()).join(' ')
    const scopeText = `${scope.name} ${scope.description || ''} ${goalTexts}`.toLowerCase()
    const matchedTopic = topicsLower.find(topic =>
      requireFullTopicMatch
        ? scopeText.includes(topic)
        : scopeText.includes(topic) || topic.includes(scope.name.toLowerCase())
    )
    if (matchedTopic) {
      if (!llmClassification) {
        return {
          scopeId: scope.id,
          scopeName: scope.name,
          reasoning: null,
          matchedGoalId: null,
          matchedGoalText: null,
        }
      }
      try {
        const classification = await classifyGoal({
          projectId,
          entityName,
          contentSnippet,
          scopeName: scope.name,
          scopeDescription: scope.description ?? '',
          goals: scopeGoals,
          matchedTopic,
        })
        return {
          scopeId: scope.id,
          scopeName: scope.name,
          reasoning: classification.reasoning,
          matchedGoalId: classification.matchedGoalId,
          matchedGoalText: classification.matchedGoalText,
        }
      } catch {
        // classifyGoal failed (e.g. LLM timeout) - return scope without goal classification
        return {
          scopeId: scope.id,
          scopeName: scope.name,
          reasoning: null,
          matchedGoalId: null,
          matchedGoalText: null,
        }
      }
    }
  }
  return null
}

/**
 * Core logic for discovering relationships. Exported for inline use.
 */
export interface IssueMatch {
  issueId: string
  name: string
  description: string
  similarity: number
  status: string
  sessionCount: number
}

export async function discoverRelationships(input: DiscoverInput): Promise<{
  relationshipsCreated: number
  productScopeId: string | null
  errors: string[]
  issueMatches: IssueMatch[]
}> {
  const { projectId, entityType, entityId, topics, combinedQuery, contentForTextMatch, entityName, contentForSearch, config } = input
  const { strategies } = config
  let relationshipsCreated = 0
  let productScopeId: string | null = null
  const errors: string[] = []
  let issueMatches: IssueMatch[] = []

  if (topics.length === 0 && !combinedQuery) {
    return { relationshipsCreated: 0, productScopeId: null, errors: [], issueMatches: [] }
  }

  // Collect all discovered matches for batch enrichment
  const discoveredMatches: DiscoveredMatch[] = []

  // 1. Product scope text match
  // Product scope already has LLM reasoning via classifyGoal, so it links directly.
  if (strategies.productScope.enabled) {
    try {
      const existingScopes = await getRelatedIds(projectId, entityType, entityId, 'product_scope')
      if (existingScopes.length === 0) {
        const match = await matchProductScope(
          projectId,
          topics,
          entityName ?? '',
          contentForSearch?.slice(0, 1500) ?? contentForTextMatch.slice(0, 1500),
          {
            requireFullTopicMatch: strategies.productScope.requireFullTopicMatch,
            llmClassification: strategies.productScope.llmClassification,
          },
        )
        if (match) {
          try {
            await linkEntities(projectId, entityType, entityId, 'product_scope', match.scopeId,
              buildProductScopeContext({
                scopeName: match.scopeName,
                topics,
                matchedGoalId: match.matchedGoalId,
                matchedGoalText: match.matchedGoalText,
                reasoning: match.reasoning,
              }) as unknown as Record<string, unknown>,
            )
            relationshipsCreated++
          } catch { /* Duplicate or constraint violation - skip */ }
          productScopeId = match.scopeId
        }
      } else {
        productScopeId = existingScopes[0]
      }
    } catch (err) {
      errors.push(`Product scope matching failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  // -------------------------------------------------------------------------
  // Steps 2-7: Search phase - collect matches without linking
  // -------------------------------------------------------------------------

  if (combinedQuery) {
    const searchTasks: Array<{ label: string; run: () => Promise<void> }> = []

    // 2. Semantic session search (skip if entityType=session)
    if (entityType !== 'session' && strategies.session.enabled) {
      searchTasks.push({
        label: 'Session search',
        run: async () => {
          const results = await searchSessionsSemantic(projectId, combinedQuery, { limit: 10, threshold: strategies.session.threshold })
          for (const session of results.slice(0, 5)) {
            discoveredMatches.push({
              targetType: 'session',
              targetId: session.sessionId,
              targetName: session.name,
              targetDescription: session.description,
              similarity: session.similarity,
              strategy: 'semantic',
            })
          }
        },
      })
    }

    // 3. Semantic issue search (skip if entityType=issue)
    if (entityType !== 'issue' && strategies.issue.enabled) {
      searchTasks.push({
        label: 'Issue search',
        run: async () => {
          const results = await searchSimilarIssues(projectId, combinedQuery, '', { limit: 10, threshold: strategies.issue.threshold })
          issueMatches = results.slice(0, 5).map((issue) => ({
            issueId: issue.issueId,
            name: issue.name,
            description: issue.description,
            similarity: issue.similarity,
            status: issue.status,
            sessionCount: issue.sessionCount,
          }))
          for (const issue of issueMatches) {
            discoveredMatches.push({
              targetType: 'issue',
              targetId: issue.issueId,
              targetName: issue.name,
              targetDescription: issue.description,
              similarity: issue.similarity,
              strategy: 'semantic',
            })
          }
        },
      })
    }

    // 4. Semantic knowledge search (skip if entityType=knowledge_source)
    if (entityType !== 'knowledge_source' && strategies.knowledge.enabled) {
      searchTasks.push({
        label: 'Knowledge search',
        run: async () => {
          const results = await searchKnowledgeBySourceIds(projectId, combinedQuery, { limit: 10, similarityThreshold: strategies.knowledge.threshold })
          const seenSourceIds = new Set<string>()
          const sourceBySimilarity = new Map<string, number>()
          for (const chunk of results) {
            if (!chunk.sourceId || sourceBySimilarity.size >= 5 && !sourceBySimilarity.has(chunk.sourceId)) continue
            if (!seenSourceIds.has(chunk.sourceId)) {
              seenSourceIds.add(chunk.sourceId)
              sourceBySimilarity.set(chunk.sourceId, chunk.similarity)
            } else {
              const best = sourceBySimilarity.get(chunk.sourceId) ?? 0
              if (chunk.similarity > best) sourceBySimilarity.set(chunk.sourceId, chunk.similarity)
            }
          }
          for (const [sourceId, similarity] of sourceBySimilarity) {
            discoveredMatches.push({
              targetType: 'knowledge_source',
              targetId: sourceId,
              targetName: sourceId, // knowledge sources don't have names in search results
              similarity,
              strategy: 'semantic',
            })
          }
        },
      })
    }

    // 5. Semantic contact search (skip if entityType=contact)
    if (entityType !== 'contact' && strategies.contact.enabled) {
      searchTasks.push({
        label: 'Contact search',
        run: async () => {
          const results = await searchContactsSemantic(projectId, combinedQuery, { limit: 10, threshold: strategies.contact.threshold })
          for (const contact of results.slice(0, 5)) {
            discoveredMatches.push({
              targetType: 'contact',
              targetId: contact.contactId,
              targetName: contact.name,
              similarity: contact.similarity,
              strategy: 'semantic',
            })
          }
        },
      })
    }

    // 6. Semantic company search (skip for contacts and company=self)
    if (entityType !== 'contact' && entityType !== 'company' && strategies.company.semanticEnabled) {
      searchTasks.push({
        label: 'Company semantic search',
        run: async () => {
          const results = await searchCompaniesSemantic(projectId, combinedQuery, { limit: 10, threshold: strategies.company.semanticThreshold })
          for (const company of results.slice(0, 5)) {
            discoveredMatches.push({
              targetType: 'company',
              targetId: company.companyId,
              targetName: company.name,
              similarity: company.similarity,
              strategy: 'semantic',
            })
          }
        },
      })
    }

    const searchResults = await Promise.allSettled(searchTasks.map((t) => t.run()))
    for (let i = 0; i < searchResults.length; i++) {
      if (searchResults[i].status === 'rejected') {
        errors.push(`${searchTasks[i].label} failed: ${(searchResults[i] as PromiseRejectedResult).reason instanceof Error ? ((searchResults[i] as PromiseRejectedResult).reason as Error).message : 'Unknown'}`)
      }
    }
  }

  // 7. Company text match fallback (skip for contacts and company=self)
  if (entityType !== 'contact' && entityType !== 'company' && strategies.company.textMatchEnabled) {
    try {
      const allCompanies = await db
        .select({ id: companies.id, name: companies.name, domain: companies.domain })
        .from(companies)
        .where(eq(companies.project_id, projectId))

      const contentLower = contentForTextMatch.toLowerCase()
      const minNameLength = strategies.company.textMatchMinNameLength
      for (const company of allCompanies) {
        const nameMatch = company.name.length >= minNameLength && contentLower.includes(company.name.toLowerCase())
        const domainMatch = company.domain && contentLower.includes(company.domain.toLowerCase())
        if (nameMatch) {
          discoveredMatches.push({
            targetType: 'company',
            targetId: company.id,
            targetName: company.name,
            strategy: 'text_match',
            matchType: 'name',
            matchedValue: company.name,
          })
        } else if (domainMatch) {
          discoveredMatches.push({
            targetType: 'company',
            targetId: company.id,
            targetName: company.name,
            strategy: 'text_match',
            matchType: 'domain',
            matchedValue: company.domain!,
          })
        }
      }
    } catch (err) {
      errors.push(`Company text match failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  // -------------------------------------------------------------------------
  // Enrichment phase: batch LLM call for human-readable context
  // -------------------------------------------------------------------------

  let llmContextMap = new Map<string, string>()
  if (discoveredMatches.length > 0) {
    try {
      llmContextMap = await enrichRelationshipContext(
        entityType,
        entityName ?? 'Unknown',
        contentForSearch?.slice(0, 2000) ?? contentForTextMatch.slice(0, 2000),
        discoveredMatches,
        projectId,
      )
      if (llmContextMap.size > 0) {
        console.log(`[discover-relationships] LLM enriched ${llmContextMap.size}/${discoveredMatches.length} matches`)
      } else {
        console.warn(`[discover-relationships] LLM enrichment returned 0 contexts for ${discoveredMatches.length} matches`)
      }
    } catch (err) {
      // Non-fatal - template context will be used as fallback
      console.warn('[discover-relationships] Enrichment call failed:', err instanceof Error ? err.message : err)
    }
  }

  // -------------------------------------------------------------------------
  // Link phase: create all relationships with enriched metadata
  // -------------------------------------------------------------------------

  const linkPromises = discoveredMatches.map((match) => {
    // Build base metadata from template builders
    const baseMeta = match.strategy === 'text_match'
      ? buildTextMatchContext({ matchType: match.matchType!, matchedValue: match.matchedValue! })
      : buildSemanticContext({ similarity: match.similarity!, topics, targetName: match.targetName })

    // Override context with LLM-generated version if available
    const llmContext = llmContextMap.get(match.targetId)
    const metadata = llmContext
      ? { ...baseMeta, context: llmContext }
      : baseMeta

    return linkEntities(
      projectId, entityType, entityId, match.targetType, match.targetId,
      metadata as unknown as Record<string, unknown>,
    )
  })

  const linkResults = await Promise.allSettled(linkPromises)
  relationshipsCreated += linkResults.filter((r) => r.status === 'fulfilled').length

  return { relationshipsCreated, productScopeId, errors, issueMatches }
}
