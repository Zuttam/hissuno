import { after } from 'next/server'
import { handleLinearWebhookEvent, verifyLinearWebhookSignature } from '@/lib/integrations/linear/webhook'
import type { LinearWebhookPayload } from '@/types/linear'

export const runtime = 'nodejs'

/**
 * POST /api/webhooks/linear
 * Handles Linear webhook events for issue state changes.
 * Signature is verified immediately using the app-level signing secret.
 */
export async function POST(request: Request) {
  try {
    const body = await request.text()

    // Verify signature immediately, before any processing
    const signature = request.headers.get('linear-signature') || ''
    if (!signature || !verifyLinearWebhookSignature(body, signature)) {
      console.warn('[webhook.linear] Invalid or missing signature')
      return new Response('Unauthorized', { status: 401 })
    }

    const payload: LinearWebhookPayload = JSON.parse(body)

    // Verify timestamp is within 60 seconds to guard against replay attacks
    if (payload.webhookTimestamp) {
      const ageMs = Date.now() - payload.webhookTimestamp
      if (Math.abs(ageMs) > 60_000) {
        console.warn('[webhook.linear] Webhook timestamp too old:', ageMs, 'ms')
        return new Response('Unauthorized', { status: 401 })
      }
    }

    // Only process Issue events
    if (payload.type !== 'Issue') {
      return new Response('OK', { status: 200 })
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
