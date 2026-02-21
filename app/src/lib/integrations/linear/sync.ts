import { createAdminClient } from '@/lib/supabase/server'
import { getLinearConnection, getLinearConnectionById, getFailedLinearSyncsDueForRetry } from './index'
import { createLinearIssue, addLinearComment } from './client'
import type { LinearSyncAction, LinearSyncResult, LinearConnectionRecord } from '@/types/linear'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = import('@supabase/supabase-js').SupabaseClient<any>

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Trigger Linear sync for an issue (fire-and-forget)
 * Call this after issue creation or spec generation
 */
export function triggerLinearSyncForIssue(
  issueId: string,
  projectId: string,
  action: LinearSyncAction
): void {
  void performLinearSync(issueId, projectId, action)
}

/**
 * Perform the actual Linear sync for an issue
 */
async function performLinearSync(
  issueId: string,
  projectId: string,
  action: LinearSyncAction
): Promise<void> {
  const supabase = createAdminClient()

  try {
    const connection = await getLinearConnection(supabase, projectId)
    if (!connection || !connection.is_enabled || !connection.team_id) {
      return
    }

    if (action === 'create') {
      await syncCreateIssue(supabase, issueId, connection)
    } else if (action === 'update_spec') {
      await syncUpdateSpec(supabase, issueId, connection)
    }
  } catch (error) {
    console.error(`[linear.sync] Failed to sync issue ${issueId} (${action}):`, error)
  }
}

/**
 * Create a Linear issue for a Hissuno issue
 */
async function syncCreateIssue(
  supabase: AnySupabase,
  issueId: string,
  connection: LinearConnectionRecord
): Promise<LinearSyncResult> {
  // Get the issue details
  const { data: issue, error: issueError } = await supabase
    .from('issues')
    .select('id, title, description, type, priority, project_id')
    .eq('id', issueId)
    .single()

  if (issueError || !issue) {
    console.error('[linear.sync] Issue not found:', issueId)
    return { success: false, error: 'Issue not found' }
  }

  // Create or get existing sync record
  const { data: existingSync } = await supabase
    .from('linear_issue_syncs')
    .select('id, linear_issue_identifier')
    .eq('issue_id', issueId)
    .single()

  // If already synced, skip
  if (existingSync?.linear_issue_identifier) {
    return { success: true, linearIssueIdentifier: existingSync.linear_issue_identifier }
  }

  // Create sync record if it doesn't exist
  let syncId: string
  if (existingSync) {
    syncId = existingSync.id
  } else {
    const { data: newSync, error: syncError } = await supabase
      .from('linear_issue_syncs')
      .insert({
        issue_id: issueId,
        connection_id: connection.id,
        last_sync_action: 'create',
        last_sync_status: 'pending',
      })
      .select('id')
      .single()

    if (syncError || !newSync) {
      console.error('[linear.sync] Failed to create sync record:', syncError)
      return { success: false, error: 'Failed to create sync record' }
    }
    syncId = newSync.id
  }

  try {
    const hissunoUrl = `${appUrl()}/issues?issue=${issue.id}`

    // Build Markdown description (Linear uses Markdown, not ADF)
    const description = buildIssueDescription(issue.description, hissunoUrl)

    const linearIssue = await createLinearIssue(connection, {
      teamId: connection.team_id!,
      title: issue.title,
      description,
    })

    // Update sync record with success
    await supabase
      .from('linear_issue_syncs')
      .update({
        linear_issue_id: linearIssue.id,
        linear_issue_identifier: linearIssue.identifier,
        linear_issue_url: linearIssue.url,
        last_sync_action: 'create',
        last_sync_status: 'success',
        last_sync_error: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', syncId)

    console.log(`[linear.sync] Created Linear issue ${linearIssue.identifier} for Hissuno issue ${issueId}`)

    return {
      success: true,
      linearIssueIdentifier: linearIssue.identifier,
      linearIssueId: linearIssue.id,
      linearIssueUrl: linearIssue.url,
    }
  } catch (error) {
    // Get current retry count and increment
    const { data: currentSync } = await supabase
      .from('linear_issue_syncs')
      .select('retry_count')
      .eq('id', syncId)
      .single()

    await supabase
      .from('linear_issue_syncs')
      .update({
        last_sync_status: 'failed',
        last_sync_error: error instanceof Error ? error.message : 'Unknown error',
        retry_count: (currentSync?.retry_count ?? 0) + 1,
      })
      .eq('id', syncId)

    console.error(`[linear.sync] Failed to create Linear issue for ${issueId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Add a spec comment to an existing Linear issue
 */
async function syncUpdateSpec(
  supabase: AnySupabase,
  issueId: string,
  connection: LinearConnectionRecord
): Promise<LinearSyncResult> {
  // Get existing sync record
  const { data: sync } = await supabase
    .from('linear_issue_syncs')
    .select('id, linear_issue_id, linear_issue_identifier')
    .eq('issue_id', issueId)
    .single()

  if (!sync?.linear_issue_id) {
    return { success: false, error: 'Issue not synced to Linear yet' }
  }

  try {
    const specUrl = `${appUrl()}/issues?issue=${issueId}`
    const commentBody = `Product spec generated. [View full spec](${specUrl})`

    await addLinearComment(connection, sync.linear_issue_id, commentBody)

    // Update sync record
    await supabase
      .from('linear_issue_syncs')
      .update({
        last_sync_action: 'update_spec',
        last_sync_status: 'success',
        last_sync_error: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', sync.id)

    console.log(`[linear.sync] Added spec comment to ${sync.linear_issue_identifier}`)
    return { success: true, linearIssueIdentifier: sync.linear_issue_identifier }
  } catch (error) {
    await supabase
      .from('linear_issue_syncs')
      .update({
        last_sync_action: 'update_spec',
        last_sync_status: 'failed',
        last_sync_error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', sync.id)

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Retry all failed syncs (called by cron job)
 */
export async function retryFailedLinearSyncs(): Promise<{
  processed: number
  successful: number
  failed: number
}> {
  const supabase = createAdminClient()
  const failedSyncs = await getFailedLinearSyncsDueForRetry(supabase)

  let successful = 0
  let failed = 0

  for (const sync of failedSyncs) {
    try {
      const connection = await getLinearConnectionById(supabase, sync.connectionId)
      if (!connection || !connection.is_enabled) {
        continue
      }

      const action = sync.lastSyncAction as LinearSyncAction

      // Increment retry count
      await supabase
        .from('linear_issue_syncs')
        .update({ retry_count: sync.retryCount + 1 })
        .eq('id', sync.syncId)

      if (action === 'create') {
        const result = await syncCreateIssue(supabase, sync.issueId, connection)
        if (result.success) {
          successful++
        } else {
          failed++
        }
      } else if (action === 'update_spec') {
        const result = await syncUpdateSpec(supabase, sync.issueId, connection)
        if (result.success) {
          successful++
        } else {
          failed++
        }
      }
    } catch (error) {
      console.error(`[linear.sync] Retry failed for sync ${sync.syncId}:`, error)
      failed++
    }
  }

  return { processed: failedSyncs.length, successful, failed }
}

/**
 * Manually retry sync for a specific issue
 */
export async function manualRetryLinearSync(issueId: string): Promise<LinearSyncResult> {
  const supabase = createAdminClient()

  const { data: sync } = await supabase
    .from('linear_issue_syncs')
    .select('id, connection_id, last_sync_action, retry_count')
    .eq('issue_id', issueId)
    .single()

  if (!sync) {
    return { success: false, error: 'No sync record found for this issue' }
  }

  const connection = await getLinearConnectionById(supabase, sync.connection_id)
  if (!connection || !connection.is_enabled) {
    return { success: false, error: 'Linear connection not found or disabled' }
  }

  // Reset retry count on manual retry
  await supabase
    .from('linear_issue_syncs')
    .update({ retry_count: 0, last_sync_status: 'pending' })
    .eq('id', sync.id)

  const action = (sync.last_sync_action ?? 'create') as LinearSyncAction
  if (action === 'create') {
    return syncCreateIssue(supabase, issueId, connection)
  } else {
    return syncUpdateSpec(supabase, issueId, connection)
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build Markdown description for Linear issue with Hissuno link
 */
function buildIssueDescription(description: string, hissunoUrl: string): string {
  return `${description}\n\n---\n\n[View in Hissuno](${hissunoUrl})`
}
