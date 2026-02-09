import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { createManualSession } from '@/lib/supabase/sessions'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { SessionTag } from '@/types/session'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

const DEMO_SESSIONS: Array<{
  name: string
  tags: SessionTag[]
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}> = [
  {
    name: 'Login page crashes on mobile Safari',
    tags: ['bug'],
    messages: [
      { role: 'user', content: 'Hi, I\'m trying to log in on my iPhone but the page keeps crashing in Safari. It works fine on desktop Chrome.' },
      { role: 'assistant', content: 'I\'m sorry to hear you\'re experiencing issues on mobile Safari. Could you tell me which iPhone model and iOS version you\'re using?' },
      { role: 'user', content: 'iPhone 14 Pro, iOS 17.2. The page loads but when I tap the password field it just freezes and then Safari reloads the page.' },
      { role: 'assistant', content: 'Thank you for those details. This sounds like it could be related to our autofill handling on iOS. I\'ve flagged this for our engineering team to investigate. In the meantime, could you try using the "Sign in with Google" option as a workaround?' },
      { role: 'user', content: 'That works, thanks! But please fix the regular login — my team members don\'t all have Google accounts.' },
    ],
  },
  {
    name: 'Feature request: Bulk export to CSV',
    tags: ['feature_request'],
    messages: [
      { role: 'user', content: 'Is there a way to export all our session data to CSV? We need to share reports with stakeholders who don\'t have access to the dashboard.' },
      { role: 'assistant', content: 'Currently we support exporting individual sessions. Are you looking to export all sessions at once, or a filtered subset?' },
      { role: 'user', content: 'Ideally a filtered subset — like all sessions from the last month tagged as "bug". We do quarterly reviews and need to pull data for different time ranges and categories.' },
      { role: 'assistant', content: 'That makes a lot of sense. I\'ll pass this along as a feature request. Being able to bulk export filtered sessions with date ranges and tag filters would be very useful for reporting workflows.' },
      { role: 'user', content: 'Exactly. Even a simple CSV with session name, date, tags, and summary would be incredibly helpful. Thanks!' },
    ],
  },
  {
    name: 'API rate limits too restrictive for our use case',
    tags: ['change_request'],
    messages: [
      { role: 'user', content: 'We\'re hitting the API rate limit when syncing customer data from our CRM. We process about 500 records per minute during peak hours.' },
      { role: 'assistant', content: 'I understand the rate limit is impacting your workflow. Could you share more about your integration setup? Specifically, are you using batch endpoints or individual requests?' },
      { role: 'user', content: 'Individual requests right now. We didn\'t see a batch endpoint in the docs. Is there one?' },
      { role: 'assistant', content: 'We do have a batch endpoint at /api/v1/sessions/batch that accepts up to 100 records per request. That should significantly reduce the number of API calls. I\'ll also flag your use case to our team — 500 records/minute is a valid enterprise workflow.' },
      { role: 'user', content: 'Oh great, the batch endpoint helps. But it would still be nice to have higher limits for paid plans. We\'re on the Pro plan.' },
    ],
  },
  {
    name: 'Love the new dashboard redesign!',
    tags: ['general_feedback', 'wins'],
    messages: [
      { role: 'user', content: 'Just wanted to say the new dashboard is fantastic! The session timeline view makes it so much easier to spot trends. My PM team loves it.' },
      { role: 'assistant', content: 'Thank you so much for the kind words! We put a lot of work into the timeline view. Is there anything specific about it that your team finds most useful?' },
      { role: 'user', content: 'The ability to see conversation sentiment over time is great. We can actually correlate it with product releases and see if changes improved or worsened the customer experience. Really powerful stuff.' },
    ],
  },
  {
    name: 'Webhook delivery failing intermittently',
    tags: ['bug'],
    messages: [
      { role: 'user', content: 'Our webhook endpoint has been receiving about 70% of events since yesterday. We\'re not seeing any errors on our end — the missing events just never arrive.' },
      { role: 'assistant', content: 'I can look into this for you. Could you share your webhook endpoint URL (or the last few characters) and the approximate timeframe when you noticed the failures?' },
      { role: 'user', content: 'The endpoint ends in /webhooks/hissuno. Started noticing around 3pm UTC yesterday. Our server logs show no incoming requests for the missing events.' },
      { role: 'assistant', content: 'I\'ve checked our delivery logs and it looks like those events are failing with a timeout. Your endpoint might be taking longer than our 10-second timeout to respond during peak hours. Could you check if there\'s any processing happening synchronously in your webhook handler?' },
      { role: 'user', content: 'Ah, yes — we were doing database writes synchronously. We\'ll queue those instead. But 10 seconds seems short, could you increase the timeout or add retry logic?' },
      { role: 'assistant', content: 'We do retry failed deliveries up to 3 times with exponential backoff, but only for 5xx responses — timeouts currently aren\'t retried. I\'ll flag this as a bug since timeouts should definitely trigger retries too.' },
    ],
  },
]

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

/**
 * POST /api/projects/[id]/demo-sessions
 * Creates demo sessions for onboarding.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    await assertUserOwnsProject(supabase, user.id, projectId)

    const created: string[] = []

    for (const demo of DEMO_SESSIONS) {
      try {
        const session = await createManualSession({
          project_id: projectId,
          name: demo.name,
          tags: demo.tags,
          messages: demo.messages,
        })
        if (session) {
          created.push(session.id)
        }
      } catch (err) {
        console.error('[demo-sessions.post] failed to create demo session:', demo.name, err)
      }
    }

    console.log('[demo-sessions.post] created', created.length, 'demo sessions for project:', projectId)
    return NextResponse.json({ created: created.length, sessionIds: created }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[demo-sessions.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to create demo sessions.' }, { status: 500 })
  }
}
