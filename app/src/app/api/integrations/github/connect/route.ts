import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError, getSafeRedirectPath } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/github/connect?projectId=xxx
 * Initiates GitHub App installation flow
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.github.connect] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const appSlug = process.env.GITHUB_APP_SLUG

  if (!appSlug) {
    console.error('[integrations.github.connect] Missing GITHUB_APP_SLUG configuration')
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
    // Support both nextUrl (new) and returnUrl (legacy) for backward compatibility
    const nextUrl =
      request.nextUrl.searchParams.get('nextUrl') || request.nextUrl.searchParams.get('returnUrl')
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

    const hasAccess = await hasProjectAccess(projectId, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized to modify this project' }, { status: 403 })
    }

    // Generate state with projectId and full redirectUrl for CSRF protection
    const nonce = crypto.randomUUID()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Determine redirect URL - use explicit nextUrl if provided and valid
    let finalRedirectUrl: string
    if (nextUrl) {
      const safePath = getSafeRedirectPath(nextUrl)
      // Security: ensure returnUrl is for the same project
      if (safePath.includes(projectId)) {
        const url = new URL(safePath, appUrl)
        if (!url.searchParams.has('github')) {
          url.searchParams.set('github', 'connected')
        }
        finalRedirectUrl = url.toString()
      } else {
        // Fallback to agents page if nextUrl doesn't match project
        finalRedirectUrl = `${appUrl}/projects/${projectId}/agents?github=connected`
      }
    } else {
      // Legacy behavior for backward compatibility (wizard flows)
      finalRedirectUrl =
        mode === 'edit'
          ? `${appUrl}/projects/${projectId}/edit?restored=true&step=${returnStep}&github=connected`
          : `${appUrl}/projects/new?restored=true&step=${returnStep}&github=connected`
    }

    const state = Buffer.from(
      JSON.stringify({
        projectId,
        userId: user.id,
        nonce,
        redirectUrl: finalRedirectUrl,
      })
    ).toString('base64url')

    // Build GitHub App installation URL
    const installUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`)
    installUrl.searchParams.set('state', state)
    // Specify which callback URL to use (must match one configured in GitHub App settings)
    installUrl.searchParams.set('redirect_uri', `${appUrl}/api/integrations/github/callback`)

    // Redirect to GitHub App installation
    return NextResponse.redirect(installUrl.toString())
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[integrations.github.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to initiate GitHub connection.' }, { status: 500 })
  }
}
