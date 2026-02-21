import { createAdminClient } from '@/lib/supabase/server'
import type { LinearWebhookPayload, LinearConnectionRecord } from '@/types/linear'
import type { IssueStatus } from '@/types/issue'

/**
 * Linear state type to Hissuno issue status mapping.
 * Linear uses state types (not names) for its workflow states.
 * null means "don't update Hissuno" for that state type.
 */
const LINEAR_STATE_TYPE_TO_HISSUNO_STATUS: Record<string, IssueStatus | null> = {
  completed: 'resolved',
  canceled: 'closed',
  started: 'in_progress',
  unstarted: null,
  backlog: null,
  triage: null,
}

/**
 * Handle a Linear webhook event
 * Only processes Issue updates with state changes
 */
export async function handleLinearWebhookEvent(
  payload: LinearWebhookPayload
): Promise<void> {
  const supabase = createAdminClient()

  // Only process Issue update events with state changes
  if (payload.type !== 'Issue' || payload.action !== 'update') return
  if (!payload.updatedFrom?.stateId) return // No state change

  const newState = payload.data.state
  if (!newState) return

  const linearIssueId = payload.data.id
  if (!linearIssueId) return

  // Find linked Hissuno issue
  const { data: sync } = await supabase
    .from('linear_issue_syncs')
    .select('issue_id')
    .eq('linear_issue_id', linearIssueId)
    .single()

  if (!sync) return

  // Map to Hissuno status using state type
  const hissunoStatus = LINEAR_STATE_TYPE_TO_HISSUNO_STATUS[newState.type]
  if (!hissunoStatus) {
    // State type not mapped or should be ignored - just update tracking
    await supabase
      .from('linear_issue_syncs')
      .update({
        last_linear_state: newState.name,
        last_linear_state_type: newState.type,
        last_webhook_received_at: new Date().toISOString(),
      })
      .eq('linear_issue_id', linearIssueId)
    return
  }

  // Update Hissuno issue status
  await supabase
    .from('issues')
    .update({ status: hissunoStatus, updated_at: new Date().toISOString() })
    .eq('id', sync.issue_id)

  // Update sync record
  await supabase
    .from('linear_issue_syncs')
    .update({
      last_linear_state: newState.name,
      last_linear_state_type: newState.type,
      last_webhook_received_at: new Date().toISOString(),
    })
    .eq('linear_issue_id', linearIssueId)

  console.log(
    `[webhook.linear] Updated issue ${sync.issue_id} to status ${hissunoStatus} (Linear: ${newState.name} [${newState.type}])`
  )
}

/**
 * Register a Linear webhook for issue state change notifications
 * Uses the Linear GraphQL API directly
 */
export async function registerLinearWebhook(
  connection: LinearConnectionRecord
): Promise<{ webhookId: string; webhookSecret: string } | null> {
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/linear`
  const crypto = await import('crypto')
  const webhookSecret = crypto.randomBytes(32).toString('hex')

  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation WebhookCreate($input: WebhookCreateInput!) {
            webhookCreate(input: $input) {
              success
              webhook {
                id
              }
            }
          }
        `,
        variables: {
          input: {
            url: webhookUrl,
            resourceTypes: ['Issue'],
            secret: webhookSecret,
            ...(connection.team_id ? { teamId: connection.team_id } : {}),
          },
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.warn('[linear.webhook] Failed to register webhook (non-blocking):', error)
      return null
    }

    const data = await response.json()
    const webhookId = data.data?.webhookCreate?.webhook?.id

    if (!webhookId) {
      console.warn('[linear.webhook] No webhook ID returned:', JSON.stringify(data.errors ?? data))
      return null
    }

    return { webhookId, webhookSecret }
  } catch (error) {
    console.warn('[linear.webhook] Webhook registration failed (non-blocking):', error)
    return null
  }
}

/**
 * Delete a Linear webhook when disconnecting
 */
export async function deleteLinearWebhook(
  connection: LinearConnectionRecord
): Promise<void> {
  if (!connection.webhook_id) return

  try {
    await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation WebhookDelete($id: String!) {
            webhookDelete(id: $id) {
              success
            }
          }
        `,
        variables: {
          id: connection.webhook_id,
        },
      }),
    })
  } catch (error) {
    // Best-effort cleanup
    console.warn('[linear.webhook] Failed to delete webhook (non-blocking):', error)
  }
}

/**
 * Verify a Linear webhook signature
 * Linear sends an HMAC-SHA256 signature in the `Linear-Signature` header
 */
export function verifyLinearWebhookSignature(
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
