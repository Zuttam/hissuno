/**
 * Issues Service Layer
 *
 * This is the single source of truth for all issue CRUD operations.
 * It orchestrates database operations and embedding updates.
 *
 * Use this service instead of calling lib/db/queries/issues.ts directly
 * for any create/update/delete operations.
 *
 * Architecture:
 * - API Routes → issues-service.ts → db/queries/issues.ts + embedding-service.ts
 * - PM Agent Tools → issues-service.ts → db/queries/issues.ts + embedding-service.ts
 * - Workflows → issues-service.ts → db/queries/issues.ts + embedding-service.ts
 */

import { isDatabaseConfigured } from '@/lib/db/config'
import {
  insertIssue,
  updateIssueById,
  deleteIssueById,
  updateIssueUpvote,
  linkSessionToIssue,
  markSessionPMReviewed,
  getIssueForUpvote,
  getIssueForEmbedding,
  updateIssueArchiveStatusById,
  getIssueProjectId,
  type InsertIssueData,
} from '@/lib/db/queries/issues'
import { getProjectById } from '@/lib/db/queries/projects'
import { searchSimilarIssues, buildIssueEmbeddingText } from './embedding-service'
import { fireEmbedding } from '@/lib/utils/embeddings'
import { searchWithFallback } from '@/lib/search/search-with-fallback'
import { db } from '@/lib/db'
import { eq, and, desc, ilike, or } from 'drizzle-orm'
import { issues } from '@/lib/db/schema/app'
import { fireGraphEval } from '@/lib/utils/graph-eval'
import type {
  IssueRecord,
  IssueWithProject,
  CreateIssueInput,
  UpdateIssueInput,
  IssuePriority,
  UpvoteResult,
} from '@/types/issue'

// ============================================================================
// Shared Utilities
// ============================================================================

// Re-export RICE utilities from shared module (importable by both server and client code)
export { calculateRICEScore, riceScoreToPriority } from './rice'

/**
 * Calculate priority based on upvote count
 */
export function calculatePriority(upvoteCount: number): IssuePriority {
  if (upvoteCount >= 5) return 'high'
  if (upvoteCount >= 3) return 'medium'
  return 'low'
}

/**
 * Fire embedding update for an issue if title or description changed.
 * Uses the shared fireEmbedding() for consistent fire-and-forget pattern.
 */
function maybeFireIssueEmbedding(
  issueId: string,
  projectId: string,
  currentTitle: string,
  currentDescription: string,
  newTitle: string | undefined,
  newDescription: string | undefined
): void {
  const titleChanged = newTitle !== undefined && newTitle !== currentTitle
  const descriptionChanged = newDescription !== undefined && newDescription !== currentDescription

  if (!titleChanged && !descriptionChanged) return

  const finalTitle = newTitle ?? currentTitle
  const finalDescription = newDescription ?? currentDescription
  fireEmbedding(issueId, 'issue', projectId, buildIssueEmbeddingText(finalTitle, finalDescription))
}

// ============================================================================
// User-Authenticated Operations (for API routes)
// ============================================================================

/**
 * Creates a new issue with embedding. Requires authenticated user context.
 */
export async function createIssue(input: CreateIssueInput): Promise<IssueWithProject> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database must be configured.')
  }

  // Look up project for return value
  const projectRow = await getProjectById(input.project_id)
  if (!projectRow) {
    throw new Error('Project not found.')
  }
  const project = { id: projectRow.id, name: projectRow.name }

  // Insert the issue
  const issue = await insertIssue({
    projectId: input.project_id,
    type: input.type,
    title: input.title,
    description: input.description,
    priority: input.priority ?? 'low',
    priorityManualOverride: true, // Manual creation always overrides
    upvoteCount: 1,
    status: 'open',
    productScopeId: input.product_scope_id ?? null,
    customFields: input.custom_fields ?? undefined,
  })

  // Link to sessions if provided
  if (input.session_ids && input.session_ids.length > 0) {
    for (const sessionId of input.session_ids) {
      await linkSessionToIssue(issue.id, sessionId)
    }
  }

  fireEmbedding(issue.id, 'issue', input.project_id, buildIssueEmbeddingText(input.title, input.description))
  fireGraphEval(input.project_id, 'issue', issue.id)

  return {
    ...issue,
    project,
  }
}

/**
 * Updates an issue with embedding update if text changed. Requires authenticated user context.
 */
export async function updateIssue(issueId: string, input: UpdateIssueInput): Promise<IssueRecord> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database must be configured.')
  }

  // Get project_id + current title/description in a single query
  const current = await getIssueForEmbedding(issueId)
  if (!current) {
    throw new Error('Issue not found.')
  }

  const projectId = current.projectId

  // Update the issue
  const issue = await updateIssueById(issueId, input)

  // Update embedding if text changed
  if (current) {
    maybeFireIssueEmbedding(issueId, projectId, current.title, current.description, input.title, input.description)
  }

  fireGraphEval(projectId, 'issue', issueId)

  return issue
}

/**
 * Deletes an issue. Requires authenticated user context.
 * Note: Embedding is deleted via CASCADE in the database.
 */
export async function deleteIssue(issueId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database must be configured.')
  }

  // Verify issue exists
  const projectId = await getIssueProjectId(issueId)
  if (!projectId) {
    return false // Issue not found
  }

  // Delete the issue (embedding cascade delete handled by DB)
  return deleteIssueById(issueId)
}

/**
 * Updates issue archive status. Requires authenticated user context.
 */
export async function updateIssueArchiveStatus(
  issueId: string,
  isArchived: boolean
): Promise<IssueRecord> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database must be configured.')
  }

  // Verify issue exists
  const projectId = await getIssueProjectId(issueId)
  if (!projectId) {
    throw new Error('Issue not found.')
  }

  return updateIssueArchiveStatusById(issueId, isArchived)
}

// ============================================================================
// Admin Operations (for PM Agent Tools and Workflows)
// ============================================================================

/**
 * Input for creating an issue via admin/agent context
 */
export interface CreateIssueAdminInput {
  projectId: string
  sessionId?: string
  type: 'bug' | 'feature_request' | 'change_request'
  title: string
  description: string
  priority?: IssuePriority
  status?: 'open' | 'ready' | 'in_progress' | 'resolved' | 'closed'
  productScopeId?: string | null
  customFields?: Record<string, unknown>
}

/**
 * Result of creating an issue via admin context
 */
export interface CreateIssueAdminResult {
  issue: IssueRecord
}

/**
 * Creates an issue with embedding. Uses admin client (no user auth required).
 * Use this for PM Agent tools and workflows.
 */
export async function createIssueAdmin(
  input: CreateIssueAdminInput
): Promise<CreateIssueAdminResult> {
  // Insert the issue (analysis scores are computed later by the analysis workflow)
  const insertData: InsertIssueData = {
    projectId: input.projectId,
    type: input.type,
    title: input.title,
    description: input.description,
    priority: input.priority ?? 'low',
    priorityManualOverride: false, // Agent-created issues use automatic priority
    upvoteCount: 1,
    status: input.status ?? 'open',
    productScopeId: input.productScopeId ?? null,
    customFields: input.customFields,
  }

  const issue = await insertIssue(insertData)

  // Link session if provided
  if (input.sessionId) {
    await Promise.all([
      linkSessionToIssue(issue.id, input.sessionId),
      markSessionPMReviewed(input.sessionId),
    ])
  }

  fireEmbedding(issue.id, 'issue', input.projectId, buildIssueEmbeddingText(input.title, input.description))
  fireGraphEval(input.projectId, 'issue', issue.id)

  return { issue }
}

/**
 * Updates an issue with embedding + graph eval. No user auth required.
 * Use this for integrations, sync jobs, and workflows.
 */
export async function updateIssueAdmin(
  issueId: string,
  projectId: string,
  input: UpdateIssueInput
): Promise<IssueRecord> {
  const issue = await updateIssueById(issueId, input)

  // Update embedding if text changed
  const current = await getIssueForEmbedding(issueId)
  if (current) {
    maybeFireIssueEmbedding(issueId, projectId, current.title, current.description, input.title, input.description)
  }

  fireGraphEval(projectId, 'issue', issueId)

  return issue
}

/**
 * Upvotes an issue and links a session. Uses admin client.
 * Returns upvote result with threshold information.
 */
export async function upvoteIssueAdmin(
  issueId: string,
  sessionId: string
): Promise<UpvoteResult> {
  // Get current issue state
  const issue = await getIssueForUpvote(issueId)
  if (!issue) {
    throw new Error(`Issue not found: ${issueId}`)
  }

  // Calculate new values
  const newUpvoteCount = issue.upvoteCount + 1
  const newPriority = issue.priorityManualOverride
    ? issue.priority
    : calculatePriority(newUpvoteCount)

  // Update issue, link session, and mark reviewed in parallel (independent operations)
  await Promise.all([
    updateIssueUpvote(issueId, newUpvoteCount, newPriority),
    linkSessionToIssue(issueId, sessionId),
    markSessionPMReviewed(sessionId),
  ])

  return {
    issueId,
    newUpvoteCount,
    newPriority,
  }
}

/**
 * Marks a session as PM reviewed. Uses admin client.
 */
export async function markSessionReviewedAdmin(sessionId: string): Promise<void> {
  await markSessionPMReviewed(sessionId)
}

// ============================================================================
// Search Operations
// ============================================================================

export interface SearchIssueResult {
  id: string
  name: string
  snippet: string
  score?: number
}

/**
 * Searches issues using semantic search with ILIKE fallback.
 */
export async function searchIssues(
  projectId: string,
  query: string,
  limit: number = 10
): Promise<SearchIssueResult[]> {
  return searchWithFallback<SearchIssueResult>({
    logPrefix: '[issues-service]',
    semanticSearch: async () => {
      const results = await searchSimilarIssues(projectId, query, query, {
        limit,
        threshold: 0.4,
        includeClosed: true,
      })
      return results.map((r) => ({
        id: r.issueId,
        name: r.title,
        snippet: r.description.slice(0, 200),
        score: r.similarity,
      }))
    },
    textFallback: async () => {
      const s = `%${query}%`
      const data = await db
        .select({
          id: issues.id,
          title: issues.title,
          description: issues.description,
          updated_at: issues.updated_at,
        })
        .from(issues)
        .where(
          and(
            eq(issues.project_id, projectId),
            eq(issues.is_archived, false),
            or(
              ilike(issues.title, s),
              ilike(issues.description, s)
            )
          )
        )
        .orderBy(desc(issues.updated_at))
        .limit(limit)

      return data.map((r) => ({
        id: r.id,
        name: r.title,
        snippet: (r.description ?? '').slice(0, 200),
        score: 0,
      }))
    },
  })
}
