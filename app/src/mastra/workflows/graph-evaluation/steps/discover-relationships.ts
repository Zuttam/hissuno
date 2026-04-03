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
import { searchSessionsSemantic } from '@/lib/sessions/embedding-service'
import { searchSimilarIssues } from '@/lib/issues/embedding-service'
import { searchKnowledgeBySourceIds } from '@/lib/knowledge/embedding-service'
import { searchContactsSemantic, searchCompaniesSemantic } from '@/lib/customers/customer-embedding-service'
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
 * Match an entity against product scopes using topic text matching + goal classification.
 * Returns the first matching scope or null.
 */
export async function matchProductScope(
  projectId: string,
  topics: string[],
  entityName: string,
  contentSnippet: string,
): Promise<{
  scopeId: string
  scopeName: string
  reasoning: string | null
  matchedGoalId: string | null
  matchedGoalText: string | null
} | null> {
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
        const classification = await classifyGoal({
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
  const { projectId, entityType, entityId, topics, combinedQuery, contentForTextMatch, entityName, contentForSearch } = input
  let relationshipsCreated = 0
  let productScopeId: string | null = null
  const errors: string[] = []
  let issueMatches: IssueMatch[] = []

  if (topics.length === 0 && !combinedQuery) {
    return { relationshipsCreated: 0, productScopeId: null, errors: [], issueMatches: [] }
  }

  // 1. Product scope text match (skip for contacts and companies)
  if (entityType !== 'contact' && entityType !== 'company') {
    try {
      const existingScopes = await getRelatedIds(projectId, entityType, entityId, 'product_scope')
      if (existingScopes.length === 0) {
        const match = await matchProductScope(
          projectId,
          topics,
          entityName ?? '',
          contentForSearch?.slice(0, 1500) ?? contentForTextMatch.slice(0, 1500),
        )
        if (match) {
          try {
            await linkEntities(projectId, entityType, entityId, 'product_scope', match.scopeId, {
              matchedGoalId: match.matchedGoalId,
              matchedGoalText: match.matchedGoalText,
              reasoning: match.reasoning,
            })
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

  // Steps 2-6: Run semantic searches in parallel (each is independent)
  if (combinedQuery) {
    const searchTasks: Array<{ label: string; run: () => Promise<void> }> = []

    // 2. Semantic session search (skip if entityType=session)
    if (entityType !== 'session') {
      searchTasks.push({
        label: 'Session search',
        run: async () => {
          const results = await searchSessionsSemantic(projectId, combinedQuery, { limit: 10, threshold: 0.6 })
          const linkResults = await Promise.allSettled(
            results.slice(0, 5).map((session) =>
              linkEntities(projectId, entityType, entityId, 'session', session.sessionId)
            )
          )
          relationshipsCreated += linkResults.filter((r) => r.status === 'fulfilled').length
        },
      })
    }

    // 3. Semantic issue search (skip if entityType=issue)
    if (entityType !== 'issue') {
      searchTasks.push({
        label: 'Issue search',
        run: async () => {
          const results = await searchSimilarIssues(projectId, combinedQuery, '', { limit: 10, threshold: 0.6 })
          issueMatches = results.slice(0, 5).map((issue) => ({
            issueId: issue.issueId,
            name: issue.name,
            description: issue.description,
            similarity: issue.similarity,
            status: issue.status,
            sessionCount: issue.sessionCount,
          }))
          const linkResults = await Promise.allSettled(
            issueMatches.map((issue) =>
              linkEntities(projectId, entityType, entityId, 'issue', issue.issueId)
            )
          )
          relationshipsCreated += linkResults.filter((r) => r.status === 'fulfilled').length
        },
      })
    }

    // 4. Semantic knowledge search (skip if entityType=knowledge_source)
    if (entityType !== 'knowledge_source') {
      searchTasks.push({
        label: 'Knowledge search',
        run: async () => {
          const results = await searchKnowledgeBySourceIds(projectId, combinedQuery, { limit: 10, similarityThreshold: 0.6 })
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
        },
      })
    }

    // 5. Semantic contact search (skip if entityType=contact)
    if (entityType !== 'contact') {
      searchTasks.push({
        label: 'Contact search',
        run: async () => {
          const results = await searchContactsSemantic(projectId, combinedQuery, { limit: 10, threshold: 0.6 })
          const linkResults = await Promise.allSettled(
            results.slice(0, 5).map((contact) =>
              linkEntities(projectId, entityType, entityId, 'contact', contact.contactId)
            )
          )
          relationshipsCreated += linkResults.filter((r) => r.status === 'fulfilled').length
        },
      })
    }

    // 6. Semantic company search (skip for contacts and company=self)
    if (entityType !== 'contact' && entityType !== 'company') {
      searchTasks.push({
        label: 'Company semantic search',
        run: async () => {
          const results = await searchCompaniesSemantic(projectId, combinedQuery, { limit: 10, threshold: 0.6 })
          const linkResults = await Promise.allSettled(
            results.slice(0, 5).map((company) =>
              linkEntities(projectId, entityType, entityId, 'company', company.companyId)
            )
          )
          relationshipsCreated += linkResults.filter((r) => r.status === 'fulfilled').length
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

  return { relationshipsCreated, productScopeId, errors, issueMatches }
}

