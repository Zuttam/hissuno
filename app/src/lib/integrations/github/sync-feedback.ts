/**
 * GitHub issue feedback sync service.
 * Syncs GitHub issues as feedback sessions.
 */

import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { githubSyncConfigs } from '@/lib/db/schema/app'
import {
  getGitHubSyncConfig,
  getGitHubInstallationUuid,
  getGitHubInstallationToken,
  getSyncedIssueIds,
  recordSyncedIssue,
} from '@/lib/integrations/github'
import { listRepoIssues, getIssueComments } from './app-client'
import type { GitHubIssue } from './app-client'
import { createSessionWithMessagesAdmin } from '@/lib/sessions/sessions-service'
import { calculateNextSyncTime, type SyncFrequency } from '@/lib/integrations/shared/sync-utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncProgressEvent {
  type: 'progress' | 'complete' | 'error'
  message: string
  processed?: number
  total?: number
  created?: number
  skipped?: number
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

/**
 * Sync GitHub issues as feedback sessions.
 */
export async function syncGitHubFeedback(
  projectId: string,
  onProgress?: (event: SyncProgressEvent) => void
): Promise<void> {
  const config = await getGitHubSyncConfig(projectId, 'feedback')
  if (!config) {
    throw new Error('GitHub feedback sync is not configured for this project')
  }

  const installationId = await getGitHubInstallationUuid(projectId)
  if (!installationId) {
    throw new Error('GitHub is not connected for this project')
  }

  const tokenResult = await getGitHubInstallationToken(projectId)
  if (!tokenResult) {
    throw new Error('Failed to get GitHub access token')
  }

  const repoIds = (config.github_repo_ids as Array<{ id: number; fullName: string }>) ?? []
  if (repoIds.length === 0) {
    throw new Error('No repositories selected for feedback sync')
  }

  // Mark sync as in_progress
  await db
    .update(githubSyncConfigs)
    .set({ last_sync_status: 'in_progress', updated_at: new Date() })
    .where(eq(githubSyncConfigs.id, config.id))

  let created = 0
  let skipped = 0
  let totalIssues = 0

  try {
    // Pre-fetch synced issue IDs for dedup
    const syncedIssueIds = await getSyncedIssueIds(installationId)

    const labelFilter = config.github_label_filter as string | null
    const labelTagMap = (config.github_label_tag_map as Record<string, string> | null) ?? {}
    const sinceDate = config.last_sync_at?.toISOString()

    for (const repo of repoIds) {
      const [owner, repoName] = repo.fullName.split('/')
      if (!owner || !repoName) continue

      onProgress?.({
        type: 'progress',
        message: `Fetching issues from ${repo.fullName}...`,
        processed: created + skipped,
        total: totalIssues,
        created,
        skipped,
      })

      const issues = await listRepoIssues(tokenResult.token, owner, repoName, {
        labels: labelFilter ?? undefined,
        since: sinceDate,
      })

      totalIssues += issues.length

      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i]

        // Skip already synced
        if (syncedIssueIds.has(issue.id)) {
          skipped++
          continue
        }

        // Fetch comments
        const comments = issue.comments > 0
          ? await getIssueComments(tokenResult.token, owner, repoName, issue.number)
          : []

        // Build messages
        const messages: Array<{ sender_type: string; content: string; created_at?: Date }> = []

        // Issue body is the first message
        if (issue.body) {
          messages.push({
            sender_type: 'user',
            content: issue.body,
            created_at: new Date(issue.created_at),
          })
        }

        // Comments become subsequent messages
        const issueAuthor = issue.user?.login
        for (const comment of comments) {
          if (!comment.body) continue
          messages.push({
            sender_type: comment.user?.login === issueAuthor ? 'user' : 'human_agent',
            content: comment.body,
            created_at: new Date(comment.created_at),
          })
        }

        // Derive tags from label mapping
        const tags = deriveTagsFromLabels(issue, labelTagMap)

        // Create session
        const result = await createSessionWithMessagesAdmin({
          projectId,
          source: 'github',
          sessionType: 'chat',
          status: 'closed',
          name: `#${issue.number} ${issue.title}`,
          userMetadata: {
            github_issue_id: String(issue.id),
            github_issue_number: String(issue.number),
            github_repo: repo.fullName,
            github_issue_url: issue.html_url,
            github_username: issue.user?.login ?? 'unknown',
            name: issue.user?.login ?? 'unknown',
          },
          firstMessageAt: new Date(issue.created_at),
          lastActivityAt: new Date(issue.updated_at),
          createdAt: new Date(issue.created_at),
          messages,
        })

        if (result) {
          // Update session tags if any derived
          if (tags.length > 0) {
            const { sessions } = await import('@/lib/db/schema/app')
            await db
              .update(sessions)
              .set({ tags })
              .where(eq(sessions.id, result.sessionId))
          }

          await recordSyncedIssue({
            installationId,
            sessionId: result.sessionId,
            githubIssueId: issue.id,
            githubIssueNumber: issue.number,
            githubRepoFullName: repo.fullName,
            githubIssueUrl: issue.html_url,
            githubIssueUpdatedAt: issue.updated_at,
          })

          created++
        } else {
          skipped++
        }

        // Report progress every 5 items
        if ((created + skipped) % 5 === 0) {
          onProgress?.({
            type: 'progress',
            message: `Processed ${created + skipped} of ${totalIssues} issues from ${repo.fullName}`,
            processed: created + skipped,
            total: totalIssues,
            created,
            skipped,
          })
        }
      }
    }

    // Update sync config with results
    const syncFrequency = (config.sync_frequency || 'manual') as SyncFrequency
    const nextSyncAt = calculateNextSyncTime(syncFrequency)

    await db
      .update(githubSyncConfigs)
      .set({
        last_sync_at: new Date(),
        last_sync_status: 'completed',
        last_sync_error: null,
        last_sync_count: created,
        next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
        updated_at: new Date(),
      })
      .where(eq(githubSyncConfigs.id, config.id))

    onProgress?.({
      type: 'complete',
      message: `Sync complete: ${created} created, ${skipped} skipped`,
      processed: created + skipped,
      total: totalIssues,
      created,
      skipped,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'

    await db
      .update(githubSyncConfigs)
      .set({
        last_sync_status: 'error',
        last_sync_error: errorMessage,
        updated_at: new Date(),
      })
      .where(eq(githubSyncConfigs.id, config.id))

    onProgress?.({
      type: 'error',
      message: `Sync failed: ${errorMessage}`,
    })

    throw error
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SESSION_TAGS = new Set([
  'general_feedback', 'wins', 'losses', 'bug', 'feature_request', 'change_request',
])

function deriveTagsFromLabels(
  issue: GitHubIssue,
  labelTagMap: Record<string, string>
): string[] {
  const tags: string[] = []
  for (const label of issue.labels) {
    const mapped = labelTagMap[label.name]
    if (mapped && VALID_SESSION_TAGS.has(mapped) && !tags.includes(mapped)) {
      tags.push(mapped)
    }
  }
  return tags
}
