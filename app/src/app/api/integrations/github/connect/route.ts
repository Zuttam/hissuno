import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getGitHubOAuthUrl } from '@/lib/integrations/github/app-client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/github/connect?projectId=xxx
 * Initiates GitHub OAuth flow
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.github.connect] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const redirectUri = process.env.GITHUB_REDIRECT_URI

  if (!clientId || !redirectUri) {
    console.error('[integrations.github.connect] Missing GitHub OAuth configuration')
    return NextResponse.json({ error: 'GitHub integration not configured.' }, { status: 500 })
  }

  try {
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
    const returnStep = request.nextUrl.searchParams.get('returnStep') || 'knowledge'
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

    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to modify this project' }, { status: 403 })
    }

    // Generate state with projectId and full redirectUrl for CSRF protection
    const nonce = crypto.randomUUID()
    const origin = request.nextUrl.origin
    const redirectUrl =
      mode === 'edit'
        ? `${origin}/projects/${projectId}/edit?restored=true&step=${returnStep}&github=connected`
        : `${origin}/projects/new?restored=true&step=${returnStep}&github=connected`

    const state = Buffer.from(
      JSON.stringify({
        projectId,
        userId: user.id,
        nonce,
        redirectUrl,
      })
    ).toString('base64url')

    const oauthUrl = getGitHubOAuthUrl({
      clientId,
      redirectUri,
      state,
    })

    // Redirect to GitHub OAuth
    return NextResponse.redirect(oauthUrl)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[integrations.github.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to initiate GitHub connection.' }, { status: 500 })
  }
}
