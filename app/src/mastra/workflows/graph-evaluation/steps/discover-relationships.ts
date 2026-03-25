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
 */

import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { productScopes, companies } from '@/lib/db/schema/app'
import { linkEntities, getRelatedIds } from '@/lib/db/queries/entity-relationships'
import { classifyGoal } from './classify-goal'
import type { GraphEntityType } from '../schemas'
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
}

/**
 * Core logic for discovering relationships. Exported for inline use.
 */
export async function discoverRelationships(input: DiscoverInput): Promise<{
  relationshipsCreated: number
  productScopeId: string | null
  errors: string[]
}> {
  const { projectId, entityType, entityId, topics, combinedQuery, contentForTextMatch, entityName, contentForSearch } = input
  let relationshipsCreated = 0
  let productScopeId: string | null = null
  const errors: string[] = []

  if (topics.length === 0 && !combinedQuery) {
    return { relationshipsCreated: 0, productScopeId: null, errors: [] }
  }

  // 1. Product scope text match (skip for contacts and companies)
  if (entityType !== 'contact' && entityType !== 'company') {
    try {
      // Check if entity already has a product scope - preserve existing
      const existingScopes = await getRelatedIds(projectId, entityType, entityId, 'product_scope')
      if (existingScopes.length === 0) {
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
            scopeText.includes(topic) || topic.includes(scope.name.toLowerCase())
          )
          if (matchedTopic) {
            try {
              // Classify which goal this entity serves
              const classification = await classifyGoal({
                entityName: entityName ?? '',
                contentSnippet: contentForSearch?.slice(0, 1500) ?? contentForTextMatch.slice(0, 1500),
                scopeName: scope.name,
                scopeDescription: scope.description ?? '',
                goals: scopeGoals,
                matchedTopic,
              })

              await linkEntities(projectId, entityType, entityId, 'product_scope', scope.id, {
                matchedGoalId: classification.matchedGoalId,
                matchedGoalText: classification.matchedGoalText,
                reasoning: classification.reasoning,
              })
              relationshipsCreated++
              if (!productScopeId) {
                productScopeId = scope.id
              }
            } catch {
              // Duplicate or invalid - skip
            }
          }
        }
      } else {
        // Already has a scope - use the first one as productScopeId
        productScopeId = existingScopes[0]
      }
    } catch (err) {
      errors.push(`Product scope matching failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  // 2. Semantic session search (skip if entityType=session)
  if (entityType !== 'session' && combinedQuery) {
    try {
      const { searchSessionsSemantic } = await import('@/lib/sessions/embedding-service')
      const results = await searchSessionsSemantic(projectId, combinedQuery, {
        limit: 10,
        threshold: 0.6,
      })
      const linkResults = await Promise.allSettled(
        results.slice(0, 5).map((session) =>
          linkEntities(projectId, entityType, entityId, 'session', session.sessionId)
        )
      )
      relationshipsCreated += linkResults.filter((r) => r.status === 'fulfilled').length
    } catch (err) {
      errors.push(`Session search failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  // 3. Semantic issue search (skip if entityType=issue)
  if (entityType !== 'issue' && combinedQuery) {
    try {
      const { searchSimilarIssues } = await import('@/lib/issues/embedding-service')
      const results = await searchSimilarIssues(projectId, combinedQuery, '', {
        limit: 10,
        threshold: 0.6,
      })
      const linkResults = await Promise.allSettled(
        results.slice(0, 5).map((issue) =>
          linkEntities(projectId, entityType, entityId, 'issue', issue.issueId)
        )
      )
      relationshipsCreated += linkResults.filter((r) => r.status === 'fulfilled').length
    } catch (err) {
      errors.push(`Issue search failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  // 4. Semantic knowledge search (skip if entityType=knowledge_source)
  if (entityType !== 'knowledge_source' && combinedQuery) {
    try {
      const { searchKnowledgeBySourceIds } = await import('@/lib/knowledge/embedding-service')
      const results = await searchKnowledgeBySourceIds(projectId, combinedQuery, {
        limit: 10,
        similarityThreshold: 0.6,
      })
      // Deduplicate by sourceId
      const seenSourceIds = new Set<string>()
      const uniqueSourceIds: string[] = []
      for (const chunk of results) {
        if (!chunk.sourceId || seenSourceIds.has(chunk.sourceId) || uniqueSourceIds.length >= 5) continue
        seenSourceIds.add(chunk.sourceId)
        uniqueSourceIds.push(chunk.sourceId)
      }
      const linkResults = await Promise.allSettled(
        uniqueSourceIds.map((sourceId) =>
          linkEntities(projectId, entityType, entityId, 'knowledge_source', sourceId)
        )
      )
      relationshipsCreated += linkResults.filter((r) => r.status === 'fulfilled').length
    } catch (err) {
      errors.push(`Knowledge search failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  // 5. Semantic contact search (skip if entityType=contact)
  if (entityType !== 'contact' && combinedQuery) {
    try {
      const { searchContactsSemantic } = await import('@/lib/customers/customer-embedding-service')
      const results = await searchContactsSemantic(projectId, combinedQuery, {
        limit: 10,
        threshold: 0.6,
      })
      const linkResults = await Promise.allSettled(
        results.slice(0, 5).map((contact) =>
          linkEntities(projectId, entityType, entityId, 'contact', contact.contactId)
        )
      )
      relationshipsCreated += linkResults.filter((r) => r.status === 'fulfilled').length
    } catch (err) {
      errors.push(`Contact search failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  // 6. Semantic company search (skip for contacts and company=self)
  if (entityType !== 'contact' && entityType !== 'company' && combinedQuery) {
    try {
      const { searchCompaniesSemantic } = await import('@/lib/customers/customer-embedding-service')
      const results = await searchCompaniesSemantic(projectId, combinedQuery, {
        limit: 10,
        threshold: 0.6,
      })
      const linkResults = await Promise.allSettled(
        results.slice(0, 5).map((company) =>
          linkEntities(projectId, entityType, entityId, 'company', company.companyId)
        )
      )
      relationshipsCreated += linkResults.filter((r) => r.status === 'fulfilled').length
    } catch (err) {
      errors.push(`Company semantic search failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  // 7. Company text match fallback (skip for contacts and company=self)
  if (entityType !== 'contact' && entityType !== 'company') {
    try {
      const allCompanies = await db
        .select({ id: companies.id, name: companies.name, domain: companies.domain })
        .from(companies)
        .where(eq(companies.project_id, projectId))

      const contentLower = contentForTextMatch.toLowerCase()
      const matchedCompanyIds: string[] = []
      for (const company of allCompanies) {
        const nameMatch = company.name.length > 2 && contentLower.includes(company.name.toLowerCase())
        const domainMatch = company.domain && contentLower.includes(company.domain.toLowerCase())
        if (nameMatch || domainMatch) {
          matchedCompanyIds.push(company.id)
        }
      }
      const linkResults = await Promise.allSettled(
        matchedCompanyIds.map((companyId) =>
          linkEntities(projectId, entityType, entityId, 'company', companyId)
        )
      )
      relationshipsCreated += linkResults.filter((r) => r.status === 'fulfilled').length
    } catch (err) {
      errors.push(`Company text match failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  return { relationshipsCreated, productScopeId, errors }
}

