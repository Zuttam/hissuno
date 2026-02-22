import { createAdminClient } from '@/lib/supabase/server'
import type { LinearWebhookPayload } from '@/types/linear'
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
 * Verify a Linear webhook signature.
 * Uses the app-level LINEAR_WEBHOOK_SIGNING_SECRET env var.
 * Linear sends an HMAC-SHA256 signature in the `Linear-Signature` header.
 */
export function verifyLinearWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secret = process.env.LINEAR_WEBHOOK_SIGNING_SECRET
  if (!secret) return false

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
