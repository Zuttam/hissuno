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

import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { resolveRequestContext } from '@/lib/db/server'
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
  verifyProjectAccess,
  getIssueProjectId,
  type InsertIssueData,
} from '@/lib/db/queries/issues'
import { upsertIssueEmbedding } from './embedding-service'
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
 * Create embedding for an issue (non-blocking, logs on failure)
 */
async function createIssueEmbedding(
  issueId: string,
  projectId: string,
  title: string,
  description: string,
  logPrefix: string
): Promise<boolean> {
  try {
    const result = await upsertIssueEmbedding(issueId, projectId, title, description)
    return result.updated
  } catch (error) {
    console.warn(`[${logPrefix}] Failed to create embedding for issue ${issueId}:`, error)
    return false
  }
}

/**
 * Update embedding for an issue if title or description changed
 */
async function maybeUpdateIssueEmbedding(
  issueId: string,
  projectId: string,
  currentTitle: string,
  currentDescription: string,
  newTitle: string | undefined,
  newDescription: string | undefined,
  logPrefix: string
): Promise<boolean> {
  // Check if title or description changed
  const titleChanged = newTitle !== undefined && newTitle !== currentTitle
  const descriptionChanged = newDescription !== undefined && newDescription !== currentDescription

  if (!titleChanged && !descriptionChanged) {
    return false
  }

  const finalTitle = newTitle ?? currentTitle
  const finalDescription = newDescription ?? currentDescription

  return createIssueEmbedding(issueId, projectId, finalTitle, finalDescription, logPrefix)
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

  await resolveRequestContext()

  // Verify user owns the project
  const project = await verifyProjectAccess(input.project_id)
  if (!project) {
    throw new UnauthorizedError('You do not have permission to create issues for this project.')
  }

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
  })

  // Link to sessions if provided
  if (input.session_ids && input.session_ids.length > 0) {
    for (const sessionId of input.session_ids) {
      await linkSessionToIssue(issue.id, sessionId)
    }
  }

  // Create embedding (non-blocking)
  await createIssueEmbedding(
    issue.id,
    input.project_id,
    input.title,
    input.description,
    'issues-service.createIssue'
  )

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

  await resolveRequestContext()

  // Get project_id + current title/description in a single query
  const current = await getIssueForEmbedding(issueId)
  if (!current) {
    throw new Error('Issue not found.')
  }

  const project = await verifyProjectAccess(current.projectId)
  if (!project) {
    throw new UnauthorizedError('You do not have permission to update this issue.')
  }

  const projectId = current.projectId

  // Update the issue
  const issue = await updateIssueById(issueId, input)

  // Update embedding if text changed (non-blocking)
  if (current) {
    await maybeUpdateIssueEmbedding(
      issueId,
      projectId,
      current.title,
      current.description,
      input.title,
      input.description,
      'issues-service.updateIssue'
    )
  }

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

  await resolveRequestContext()

  // Verify user owns the project this issue belongs to
  const projectId = await getIssueProjectId(issueId)
  if (!projectId) {
    return false // Issue not found
  }

  const project = await verifyProjectAccess(projectId)
  if (!project) {
    throw new UnauthorizedError('You do not have permission to delete this issue.')
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

  await resolveRequestContext()

  // Verify user owns the project this issue belongs to
  const projectId = await getIssueProjectId(issueId)
  if (!projectId) {
    throw new Error('Issue not found.')
  }

  const project = await verifyProjectAccess(projectId)
  if (!project) {
    throw new UnauthorizedError('You do not have permission to update this issue.')
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
  productScopeId?: string | null
}

/**
 * Result of creating an issue via admin context
 */
export interface CreateIssueAdminResult {
  issue: IssueRecord
  embeddingCreated: boolean
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
    status: 'open',
    productScopeId: input.productScopeId ?? null,
  }

  const issue = await insertIssue(insertData)

  // Link session if provided
  if (input.sessionId) {
    await Promise.all([
      linkSessionToIssue(issue.id, input.sessionId),
      markSessionPMReviewed(input.sessionId),
    ])
  }

  // Create embedding (non-blocking)
  const embeddingCreated = await createIssueEmbedding(
    issue.id,
    input.projectId,
    input.title,
    input.description,
    'issues-service.createIssueAdmin'
  )

  return { issue, embeddingCreated }
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
