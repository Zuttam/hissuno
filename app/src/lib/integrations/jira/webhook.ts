import { createAdminClient } from '@/lib/supabase/server'
import type { JiraWebhookPayload, JiraConnectionRecord } from '@/types/jira'
import type { IssueStatus } from '@/types/issue'

/**
 * Jira status name to Hissuno issue status mapping.
 * Uses Jira status names (case-sensitive as returned by Jira API).
 * null means "don't update Hissuno" for that status.
 */
const JIRA_TO_HISSUNO_STATUS: Record<string, IssueStatus | null> = {
  // Status Category: done
  'Done': 'resolved',
  'Resolved': 'resolved',
  'Closed': 'resolved',

  // Rejection statuses (still category: done)
  "Won't Do": 'closed',
  'Rejected': 'closed',
  'Declined': 'closed',
  'Cancelled': 'closed',

  // Status Category: indeterminate (in progress)
  'In Progress': 'in_progress',
  'In Review': 'in_progress',
  'In Development': 'in_progress',

  // Status Category: new (not started) - don't update
  'To Do': null,
  'Open': null,
  'Backlog': null,
}

/**
 * Handle a Jira webhook event
 * Only processes issue_updated events with status changes
 */
export async function handleJiraWebhookEvent(
  payload: JiraWebhookPayload,
  connectionId: string
): Promise<void> {
  const supabase = createAdminClient()

  // Only process issue_updated events with status changes
  if (payload.webhookEvent !== 'jira:issue_updated') return

  const statusChange = payload.changelog?.items?.find(
    (item) => item.field === 'status'
  )
  if (!statusChange) return

  const newJiraStatus = statusChange.toString
  const jiraIssueKey = payload.issue.key

  if (!newJiraStatus || !jiraIssueKey) return

  // Find linked Hissuno issue
  const { data: sync } = await supabase
    .from('jira_issue_syncs')
    .select('issue_id')
    .eq('jira_issue_key', jiraIssueKey)
    .single()

  if (!sync) return

  // Map to Hissuno status
  const hissunoStatus = JIRA_TO_HISSUNO_STATUS[newJiraStatus]
  if (!hissunoStatus) {
    // Status not mapped or should be ignored - just update tracking
    await supabase
      .from('jira_issue_syncs')
      .update({
        last_jira_status: newJiraStatus,
        last_webhook_received_at: new Date().toISOString(),
      })
      .eq('jira_issue_key', jiraIssueKey)
    return
  }

  // Update Hissuno issue status
  await supabase
    .from('issues')
    .update({ status: hissunoStatus, updated_at: new Date().toISOString() })
    .eq('id', sync.issue_id)

  // Update sync record
  await supabase
    .from('jira_issue_syncs')
    .update({
      last_jira_status: newJiraStatus,
      last_webhook_received_at: new Date().toISOString(),
    })
    .eq('jira_issue_key', jiraIssueKey)

  console.log(
    `[webhook.jira] Updated issue ${sync.issue_id} to status ${hissunoStatus} (Jira: ${newJiraStatus})`
  )
}

/**
 * Register a Jira webhook for status change notifications
 * Called during OAuth callback after token exchange
 *
 * NOTE: This uses the Jira REST API webhook endpoint which may require
 * specific app permissions. If webhooks aren't available for your OAuth app type,
 * use the cron-based polling approach instead.
 */
export async function registerJiraWebhook(
  connection: JiraConnectionRecord
): Promise<{ webhookId: string; webhookSecret: string } | null> {
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/jira`
  const crypto = await import('crypto')
  const webhookSecret = crypto.randomBytes(32).toString('hex')

  try {
    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${connection.cloud_id}/rest/api/3/webhook`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          webhooks: [
            {
              events: ['jira:issue_updated'],
              jqlFilter: 'labels = hissuno',
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.warn('[jira.webhook] Failed to register webhook (non-blocking):', error)
      // Webhook registration failure is non-blocking - polling can be used as fallback
      return null
    }

    const data = await response.json()
    const webhookId = data.webhookRegistrationResult?.[0]?.createdWebhookId

    if (!webhookId) {
      console.warn('[jira.webhook] No webhook ID returned')
      return null
    }

    return { webhookId: String(webhookId), webhookSecret }
  } catch (error) {
    console.warn('[jira.webhook] Webhook registration failed (non-blocking):', error)
    return null
  }
}

/**
 * Delete a Jira webhook when disconnecting
 */
export async function deleteJiraWebhook(
  connection: JiraConnectionRecord
): Promise<void> {
  if (!connection.webhook_id) return

  try {
    await fetch(
      `https://api.atlassian.com/ex/jira/${connection.cloud_id}/rest/api/3/webhook`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookIds: [parseInt(connection.webhook_id, 10)],
        }),
      }
    )
  } catch (error) {
    // Best-effort cleanup - don't throw
    console.warn('[jira.webhook] Failed to delete webhook (non-blocking):', error)
  }
}

/**
 * Verify a Jira webhook signature
 * Note: Jira Cloud webhooks may not include signatures depending on the webhook type.
 * This is included for completeness but may not be used.
 */
export function verifyJiraWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const crypto = require('crypto') as typeof import('crypto')
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(body)
    const expected = hmac.digest('hex')
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8')
    )
  } catch {
    return false
  }
}
