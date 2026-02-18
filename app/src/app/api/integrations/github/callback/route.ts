import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { storeGitHubInstallation } from '@/lib/integrations/github'
import { getInstallationInfo } from '@/lib/integrations/github/jwt'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/github/callback
 * Handles GitHub App installation callback
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin

  if (!isSupabaseConfigured()) {
    console.error('[integrations.github.callback] Supabase must be configured')
    return redirectWithError('Supabase must be configured.', origin)
  }

  try {
    // GitHub App installation sends: installation_id, setup_action, state
    const installationId = request.nextUrl.searchParams.get('installation_id')
    const setupAction = request.nextUrl.searchParams.get('setup_action')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    // Handle user declining installation
    if (error) {
      console.log('[integrations.github.callback] User declined:', error)
      return redirectWithError('GitHub App installation was declined.', origin)
    }

    if (!installationId || !state) {
      console.error('[integrations.github.callback] Missing installation_id or state')
      return redirectWithError('Missing installation_id or state.', origin)
    }

    console.log('[integrations.github.callback] Received installation:', {
      installationId,
      setupAction,
    })

    // Decode and validate state
    let stateData: { projectId: string; userId: string; nonce: string; redirectUrl: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
    } catch {
      return redirectWithError('Invalid state parameter.', origin)
    }

    const { projectId, userId, redirectUrl } = stateData

    if (!projectId || !userId || !redirectUrl) {
      return redirectWithError('Invalid state data.', origin)
    }

    // Use admin client to verify the project belongs to the userId from state
    const adminSupabase = createAdminClient()
    const { data: project, error: projectError } = await adminSupabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return redirectWithError('Project not found.', origin)
    }

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      return redirectWithError('Project access denied.', origin)
    }

    // Fetch installation details from GitHub
    const installationInfo = await getInstallationInfo(Number(installationId))

    // Store the installation (reuse admin client from above)
    const storeResult = await storeGitHubInstallation(adminSupabase, {
      projectId,
      installationId: Number(installationId),
      accountLogin: installationInfo.account.login,
      accountId: installationInfo.account.id,
      targetType: installationInfo.account.type,
      installedByUserId: userId,
    })

    if (!storeResult.success) {
      console.error('[integrations.github.callback] Failed to store installation:', storeResult.error)
      return redirectWithError('Failed to save GitHub connection.', origin)
    }

    // Redirect back to the page specified in state
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('[integrations.github.callback] unexpected error', error)
    return redirectWithError('An unexpected error occurred.', origin)
  }
}

function redirectWithError(message: string, origin: string): NextResponse {
  const errorUrl = new URL('/projects', origin)
  errorUrl.searchParams.set('github_error', message)
  return NextResponse.redirect(errorUrl.toString())
}
