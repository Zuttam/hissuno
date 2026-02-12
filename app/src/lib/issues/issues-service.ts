/**
 * Issues Service Layer
 *
 * This is the single source of truth for all issue CRUD operations.
 * It orchestrates database operations and embedding updates.
 *
 * Use this service instead of calling lib/supabase/issues.ts directly
 * for any create/update/delete operations.
 *
 * Architecture:
 * - API Routes → issues-service.ts → supabase/issues.ts + embedding-service.ts
 * - PM Agent Tools → issues-service.ts → supabase/issues.ts + embedding-service.ts
 * - Workflows → issues-service.ts → supabase/issues.ts + embedding-service.ts
 */

import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
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
  verifyProjectOwnership,
  getIssueProjectId,
  type InsertIssueData,
} from '@/lib/supabase/issues'
import { upsertIssueEmbedding } from './embedding-service'
import { triggerJiraSyncForIssue } from '@/lib/integrations/jira/sync'
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

/**
 * Calculate priority based on upvote count (legacy fallback)
 */
export function calculatePriority(upvoteCount: number): IssuePriority {
  if (upvoteCount >= 5) return 'high'
  if (upvoteCount >= 3) return 'medium'
  return 'low'
}

/**
 * Calculate multi-factor priority from velocity, impact, and effort scores.
 *
 * With effort: composite = velocity * 0.3 + impact * 0.5 + effortInverse * 0.2
 * Without effort: composite = velocity * 0.35 + impact * 0.65
 * Where effortInverse = 6 - effortScore (higher effort = lower priority boost)
 *
 * Mapping: >= 3.5 = high, >= 2.0 = medium, else low
 */
export function calculateMultiFactorPriority(
  velocityScore: number | null,
  impactScore: number | null,
  effortScore: number | null
): IssuePriority | null {
  if (velocityScore == null && impactScore == null) {
    return null // No scores available, cannot calculate
  }

  const velocity = velocityScore ?? 1
  const impact = impactScore ?? 1

  let composite: number
  if (effortScore != null) {
    const effortInverse = 6 - effortScore
    composite = velocity * 0.3 + impact * 0.5 + effortInverse * 0.2
  } else {
    composite = velocity * 0.35 + impact * 0.65
  }

  if (composite >= 3.5) return 'high'
  if (composite >= 2.0) return 'medium'
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
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new UnauthorizedError('Unable to resolve user context.')
  }

  // Verify user owns the project
  const project = await verifyProjectOwnership(supabase, input.project_id, user.id)
  if (!project) {
    throw new UnauthorizedError('You do not have permission to create issues for this project.')
  }

  // Insert the issue
  const issue = await insertIssue(supabase, {
    projectId: input.project_id,
    type: input.type,
    title: input.title,
    description: input.description,
    priority: input.priority ?? 'low',
    priorityManualOverride: true, // Manual creation always overrides
    upvoteCount: 1,
    status: 'open',
  })

  // Link to sessions if provided
  if (input.session_ids && input.session_ids.length > 0) {
    for (const sessionId of input.session_ids) {
      await linkSessionToIssue(supabase, issue.id, sessionId)
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

  // Trigger Jira sync (fire-and-forget)
  triggerJiraSyncForIssue(issue.id, input.project_id, 'create')

  return {
    ...issue,
    project,
  }
}

/**
 * Updates an issue with embedding update if text changed. Requires authenticated user context.
 */
export async function updateIssue(issueId: string, input: UpdateIssueInput): Promise<IssueRecord> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new UnauthorizedError('Unable to resolve user context.')
  }

  // Verify user owns the project this issue belongs to
  const projectId = await getIssueProjectId(supabase, issueId)
  if (!projectId) {
    throw new Error('Issue not found.')
  }

  const project = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!project) {
    throw new UnauthorizedError('You do not have permission to update this issue.')
  }

  // Get current title/description for embedding comparison
  const current = await getIssueForEmbedding(supabase, issueId)

  // Update the issue
  const issue = await updateIssueById(supabase, issueId, input)

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
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new UnauthorizedError('Unable to resolve user context.')
  }

  // Verify user owns the project this issue belongs to
  const projectId = await getIssueProjectId(supabase, issueId)
  if (!projectId) {
    return false // Issue not found
  }

  const project = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!project) {
    throw new UnauthorizedError('You do not have permission to delete this issue.')
  }

  // Delete the issue (embedding cascade delete handled by DB)
  return deleteIssueById(supabase, issueId)
}

/**
 * Updates issue archive status. Requires authenticated user context.
 */
export async function updateIssueArchiveStatus(
  issueId: string,
  isArchived: boolean
): Promise<IssueRecord> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new UnauthorizedError('Unable to resolve user context.')
  }

  // Verify user owns the project this issue belongs to
  const projectId = await getIssueProjectId(supabase, issueId)
  if (!projectId) {
    throw new Error('Issue not found.')
  }

  const project = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!project) {
    throw new UnauthorizedError('You do not have permission to update this issue.')
  }

  return updateIssueArchiveStatusById(supabase, issueId, isArchived)
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
  const supabase = createAdminClient()

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
  }

  const issue = await insertIssue(supabase, insertData)

  // Link session if provided
  if (input.sessionId) {
    await linkSessionToIssue(supabase, issue.id, input.sessionId)
    await markSessionPMReviewed(supabase, input.sessionId)
  }

  // Create embedding (non-blocking)
  const embeddingCreated = await createIssueEmbedding(
    issue.id,
    input.projectId,
    input.title,
    input.description,
    'issues-service.createIssueAdmin'
  )

  // Trigger Jira sync (fire-and-forget)
  triggerJiraSyncForIssue(issue.id, input.projectId, 'create')

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
  const supabase = createAdminClient()

  // Get current issue state
  const issue = await getIssueForUpvote(supabase, issueId)
  if (!issue) {
    throw new Error(`Issue not found: ${issueId}`)
  }

  // Calculate new values
  const newUpvoteCount = issue.upvoteCount + 1
  const newPriority = issue.priorityManualOverride
    ? issue.priority
    : calculatePriority(newUpvoteCount)

  // Update the issue
  await updateIssueUpvote(supabase, issueId, newUpvoteCount, newPriority)

  // Link session to issue
  await linkSessionToIssue(supabase, issueId, sessionId)

  // Mark session as PM reviewed
  await markSessionPMReviewed(supabase, sessionId)

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
  const supabase = createAdminClient()
  await markSessionPMReviewed(supabase, sessionId)
}
