import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { handleLinearWebhookEvent, verifyLinearWebhookSignature } from '@/lib/integrations/linear/webhook'
import type { LinearWebhookPayload } from '@/types/linear'

export const runtime = 'nodejs'

/**
 * POST /api/webhooks/linear
 * Handles Linear webhook events for issue state changes
 */
export async function POST(request: Request) {
  try {
    const body = await request.text()
    const payload: LinearWebhookPayload = JSON.parse(body)

    // Only process Issue events
    if (payload.type !== 'Issue') {
      return new Response('OK', { status: 200 })
    }

    const linearIssueId = payload.data?.id
    if (!linearIssueId) {
      return new Response('OK', { status: 200 })
    }

    // Find the sync record to get the connection for signature verification
    const supabase = createAdminClient()
    const { data: sync } = await supabase
      .from('linear_issue_syncs')
      .select('connection_id')
      .eq('linear_issue_id', linearIssueId)
      .single()

    if (!sync) {
      // Not our issue or not synced yet
      return new Response('OK', { status: 200 })
    }

    // Verify signature if we have the secret
    const { data: connection } = await supabase
      .from('linear_connections')
      .select('webhook_secret')
      .eq('id', sync.connection_id)
      .single()

    if (connection?.webhook_secret) {
      const signature = request.headers.get('linear-signature') || ''
      if (signature && !verifyLinearWebhookSignature(body, signature, connection.webhook_secret)) {
        console.warn('[webhook.linear] Invalid signature')
        return new Response('Unauthorized', { status: 401 })
      }
    }

    // Process asynchronously
    after(async () => {
      try {
        await handleLinearWebhookEvent(payload)
      } catch (error) {
        console.error('[webhook.linear] Event handler error:', error)
      }
    })

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[webhook.linear] Error processing webhook:', error)
    return new Response('OK', { status: 200 }) // Always return 200 to Linear
  }
}
