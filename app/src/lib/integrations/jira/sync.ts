import { createAdminClient } from '@/lib/supabase/server'
import { getJiraConnection, getJiraConnectionById, getFailedSyncsDueForRetry } from './index'
import { createJiraIssue, addJiraComment, buildIssueDescription, buildSpecComment } from './client'
import type { JiraSyncAction, JiraSyncResult, JiraConnectionRecord, JiraIssueSyncRecord } from '@/types/jira'
import type { IssueRecord } from '@/types/issue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = import('@supabase/supabase-js').SupabaseClient<any>

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Trigger Jira sync for an issue (fire-and-forget)
 * Call this after issue creation or spec generation
 */
export function triggerJiraSyncForIssue(
  issueId: string,
  projectId: string,
  action: JiraSyncAction
): void {
  // Fire and forget - don't block the caller
  void performJiraSync(issueId, projectId, action)
}

/**
 * Perform the actual Jira sync for an issue
 */
async function performJiraSync(
  issueId: string,
  projectId: string,
  action: JiraSyncAction
): Promise<void> {
  const supabase = createAdminClient()

  try {
    // Get Jira connection for this project
    const connection = await getJiraConnection(supabase, projectId)
    if (!connection || !connection.is_enabled || !connection.jira_project_key || !connection.issue_type_id) {
      return // No active Jira connection or not configured
    }

    if (action === 'create') {
      await syncCreateIssue(supabase, issueId, connection)
    } else if (action === 'update_spec') {
      await syncUpdateSpec(supabase, issueId, connection)
    }
  } catch (error) {
    console.error(`[jira.sync] Failed to sync issue ${issueId} (${action}):`, error)
  }
}

/**
 * Create a Jira ticket for a Hissuno issue
 */
async function syncCreateIssue(
  supabase: AnySupabase,
  issueId: string,
  connection: JiraConnectionRecord
): Promise<JiraSyncResult> {
  // Get the issue details
  const { data: issue, error: issueError } = await supabase
    .from('issues')
    .select('id, title, description, type, priority, project_id')
    .eq('id', issueId)
    .single()

  if (issueError || !issue) {
    console.error('[jira.sync] Issue not found:', issueId)
    return { success: false, error: 'Issue not found' }
  }

  // Create or get existing sync record
  const { data: existingSync } = await supabase
    .from('jira_issue_syncs')
    .select('id, jira_issue_key')
    .eq('issue_id', issueId)
    .single()

  // If already synced, skip
  if (existingSync?.jira_issue_key) {
    return { success: true, jiraIssueKey: existingSync.jira_issue_key }
  }

  // Create sync record if it doesn't exist
  let syncId: string
  if (existingSync) {
    syncId = existingSync.id
  } else {
    const { data: newSync, error: syncError } = await supabase
      .from('jira_issue_syncs')
      .insert({
        issue_id: issueId,
        connection_id: connection.id,
        last_sync_action: 'create',
        last_sync_status: 'pending',
      })
      .select('id')
      .single()

    if (syncError || !newSync) {
      console.error('[jira.sync] Failed to create sync record:', syncError)
      return { success: false, error: 'Failed to create sync record' }
    }
    syncId = newSync.id
  }

  try {
    const hissunoUrl = `${appUrl()}/issues?issue=${issue.id}`
    const description = buildIssueDescription(issue.description, hissunoUrl)

    const jiraIssue = await createJiraIssue(connection, {
      fields: {
        project: { key: connection.jira_project_key! },
        summary: issue.title,
        description,
        issuetype: { id: connection.issue_type_id! },
        labels: ['hissuno'],
      },
    })

    const jiraIssueUrl = `${connection.site_url}/browse/${jiraIssue.key}`

    // Update sync record with success
    await supabase
      .from('jira_issue_syncs')
      .update({
        jira_issue_key: jiraIssue.key,
        jira_issue_id: jiraIssue.id,
        jira_issue_url: jiraIssueUrl,
        last_sync_action: 'create',
        last_sync_status: 'success',
        last_sync_error: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', syncId)

    console.log(`[jira.sync] Created Jira issue ${jiraIssue.key} for Hissuno issue ${issueId}`)

    return {
      success: true,
      jiraIssueKey: jiraIssue.key,
      jiraIssueId: jiraIssue.id,
      jiraIssueUrl,
    }
  } catch (error) {
    // Get current retry count and increment
    const { data: currentSync } = await supabase
      .from('jira_issue_syncs')
      .select('retry_count')
      .eq('id', syncId)
      .single()

    await supabase
      .from('jira_issue_syncs')
      .update({
        last_sync_status: 'failed',
        last_sync_error: error instanceof Error ? error.message : 'Unknown error',
        retry_count: (currentSync?.retry_count ?? 0) + 1,
      })
      .eq('id', syncId)

    console.error(`[jira.sync] Failed to create Jira issue for ${issueId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Add a spec comment to an existing Jira ticket
 */
async function syncUpdateSpec(
  supabase: AnySupabase,
  issueId: string,
  connection: JiraConnectionRecord
): Promise<JiraSyncResult> {
  // Get existing sync record
  const { data: sync } = await supabase
    .from('jira_issue_syncs')
    .select('id, jira_issue_key')
    .eq('issue_id', issueId)
    .single()

  if (!sync?.jira_issue_key) {
    return { success: false, error: 'Issue not synced to Jira yet' }
  }

  try {
    const specUrl = `${appUrl()}/issues?issue=${issueId}`
    const commentBody = buildSpecComment(specUrl)

    await addJiraComment(connection, sync.jira_issue_key, commentBody)

    // Update sync record
    await supabase
      .from('jira_issue_syncs')
      .update({
        last_sync_action: 'update_spec',
        last_sync_status: 'success',
        last_sync_error: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', sync.id)

    console.log(`[jira.sync] Added spec comment to ${sync.jira_issue_key}`)
    return { success: true, jiraIssueKey: sync.jira_issue_key }
  } catch (error) {
    await supabase
      .from('jira_issue_syncs')
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
export async function retryFailedSyncs(): Promise<{
  processed: number
  successful: number
  failed: number
}> {
  const supabase = createAdminClient()
  const failedSyncs = await getFailedSyncsDueForRetry(supabase)

  let successful = 0
  let failed = 0

  for (const sync of failedSyncs) {
    try {
      const connection = await getJiraConnectionById(supabase, sync.connectionId)
      if (!connection || !connection.is_enabled) {
        continue
      }

      const action = sync.lastSyncAction as JiraSyncAction

      // Increment retry count
      await supabase
        .from('jira_issue_syncs')
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
      console.error(`[jira.sync] Retry failed for sync ${sync.syncId}:`, error)
      failed++
    }
  }

  return { processed: failedSyncs.length, successful, failed }
}

/**
 * Manually retry sync for a specific issue
 */
export async function manualRetrySync(issueId: string): Promise<JiraSyncResult> {
  const supabase = createAdminClient()

  const { data: sync } = await supabase
    .from('jira_issue_syncs')
    .select('id, connection_id, last_sync_action, retry_count')
    .eq('issue_id', issueId)
    .single()

  if (!sync) {
    return { success: false, error: 'No sync record found for this issue' }
  }

  const connection = await getJiraConnectionById(supabase, sync.connection_id)
  if (!connection || !connection.is_enabled) {
    return { success: false, error: 'Jira connection not found or disabled' }
  }

  // Reset retry count on manual retry
  await supabase
    .from('jira_issue_syncs')
    .update({ retry_count: 0, last_sync_status: 'pending' })
    .eq('id', sync.id)

  const action = (sync.last_sync_action ?? 'create') as JiraSyncAction
  if (action === 'create') {
    return syncCreateIssue(supabase, issueId, connection)
  } else {
    return syncUpdateSpec(supabase, issueId, connection)
  }
}
