import { NextRequest, NextResponse } from 'next/server'
import { verifySlackRequest } from '@/lib/integrations/slack'
import { handleSlackEvent } from '@/lib/integrations/slack/event-handlers'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/slack/events
 * Handles Slack Events API webhooks
 * https://api.slack.com/apis/connections/events-api
 */
export async function POST(request: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET

  if (!signingSecret) {
    console.error('[integrations.slack.events] Missing SLACK_SIGNING_SECRET')
    return NextResponse.json({ error: 'Slack not configured' }, { status: 500 })
  }

  try {
    // Get raw body for signature verification
    const rawBody = await request.text()

    // Get Slack headers
    const timestamp = request.headers.get('x-slack-request-timestamp') || ''
    const signature = request.headers.get('x-slack-signature') || ''

    // Verify request signature
    if (!verifySlackRequest(rawBody, timestamp, signature, signingSecret)) {
      console.warn('[integrations.slack.events] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse the payload
    const payload = JSON.parse(rawBody)

    // Handle URL verification challenge (used when setting up Events API)
    if (payload.type === 'url_verification') {
      return NextResponse.json({ challenge: payload.challenge })
    }

    // Handle event callbacks
    if (payload.type === 'event_callback') {
      const event = payload.event

      // Respond immediately to Slack (must respond within 3 seconds)
      // Process the event asynchronously
      setImmediate(() => {
        handleSlackEvent({
          teamId: payload.team_id,
          event,
          eventId: payload.event_id,
          eventTime: payload.event_time,
        }).catch((error) => {
          console.error('[integrations.slack.events] Event handler error:', error)
        })
      })

      // Return 200 OK immediately
      return NextResponse.json({ ok: true })
    }

    // Unknown payload type
    console.warn('[integrations.slack.events] Unknown payload type:', payload.type)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[integrations.slack.events] unexpected error', error)
    return NextResponse.json({ error: 'Failed to process event' }, { status: 500 })
  }
}
