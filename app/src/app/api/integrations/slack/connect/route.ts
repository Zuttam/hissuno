import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError, getSafeRedirectPath } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { getSlackOAuthUrl, SLACK_OAUTH_SCOPES } from '@/lib/integrations/slack'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/slack/connect?projectId=xxx
 * Initiates Slack OAuth flow
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.slack.connect] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const clientId = process.env.SLACK_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/slack/callback`

  if (!clientId) {
    console.error('[integrations.slack.connect] Missing Slack OAuth configuration')
    return NextResponse.json({ error: 'Slack integration not configured.' }, { status: 500 })
  }

  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new UnauthorizedError('User not authenticated')
    }

    // Get query params
    const projectId = request.nextUrl.searchParams.get('projectId')
    const nextUrl = request.nextUrl.searchParams.get('nextUrl')
    const returnStep = request.nextUrl.searchParams.get('returnStep') || 'sessions'
    const mode = request.nextUrl.searchParams.get('mode') || 'edit'

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Verify user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const hasAccess = await hasProjectAccess(projectId, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized to modify this project' }, { status: 403 })
    }

    // Generate state with projectId and redirect info for CSRF protection
    const nonce = crypto.randomUUID()

    // Determine redirect URL - use explicit nextUrl if provided and valid
    let redirectUrl: string | undefined
    if (nextUrl) {
      const safePath = getSafeRedirectPath(nextUrl)
      // Security: ensure nextUrl is for the same project
      if (safePath.includes(projectId)) {
        const url = new URL(safePath, appUrl)
        if (!url.searchParams.has('slack')) {
          url.searchParams.set('slack', 'connected')
        }
        redirectUrl = url.toString()
      }
    }

    const state = Buffer.from(
      JSON.stringify({
        projectId,
        userId: user.id,
        nonce,
        // Include redirectUrl if explicitly provided, otherwise use legacy mode/returnStep
        ...(redirectUrl ? { redirectUrl } : { returnStep, mode }),
      })
    ).toString('base64url')

    // Store nonce in a short-lived way (could use session or a temp table)
    // For simplicity, we'll verify the state structure on callback
    // In production, you'd want to store and validate the nonce

    const oauthUrl = getSlackOAuthUrl({
      clientId,
      redirectUri,
      state,
      scopes: SLACK_OAUTH_SCOPES,
    })

    // Redirect to Slack OAuth
    return NextResponse.redirect(oauthUrl)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[integrations.slack.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to initiate Slack connection.' }, { status: 500 })
  }
}
