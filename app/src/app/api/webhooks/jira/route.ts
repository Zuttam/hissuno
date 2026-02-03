import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { handleJiraWebhookEvent } from '@/lib/integrations/jira/webhook'

export const runtime = 'nodejs'

/**
 * POST /api/webhooks/jira
 * Handles Jira webhook events for issue status changes
 */
export async function POST(request: Request) {
  try {
    const body = await request.text()
    const payload = JSON.parse(body)

    const issueKey = payload.issue?.key
    const labels: string[] = payload.issue?.fields?.labels || []

    // Only process issues with "hissuno" label (our issues)
    if (!labels.includes('hissuno')) {
      return new Response('OK', { status: 200 })
    }

    if (!issueKey) {
      return new Response('Missing issue key', { status: 400 })
    }

    // Find sync record by issue key to verify this is our issue
    const supabase = createAdminClient()
    const { data: sync } = await supabase
      .from('jira_issue_syncs')
      .select('connection_id')
      .eq('jira_issue_key', issueKey)
      .single()

    if (!sync) {
      console.warn(`[webhook.jira] Issue ${issueKey} has hissuno label but not found in DB`)
      return new Response('OK', { status: 200 })
    }

    // Process asynchronously (immediate response pattern from Slack)
    setImmediate(() => {
      void handleJiraWebhookEvent(payload, sync.connection_id)
    })

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[webhook.jira] Error processing webhook:', error)
    return new Response('OK', { status: 200 }) // Always return 200 to Jira
  }
}
