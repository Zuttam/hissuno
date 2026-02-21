import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { exchangeCodeForTokens, getAccessibleResources } from '@/lib/integrations/jira/oauth'
import { storeJiraConnection } from '@/lib/integrations/jira'
import { registerJiraWebhook } from '@/lib/integrations/jira/webhook'
import type { JiraOAuthState } from '@/types/jira'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/jira/callback
 * Handles Jira OAuth callback after user authorizes
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return redirectWithError('Supabase must be configured.')
  }

  const clientId = process.env.JIRA_CLIENT_ID
  const clientSecret = process.env.JIRA_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/jira/callback`

  if (!clientId || !clientSecret) {
    return redirectWithError('Jira integration not configured.')
  }

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    // Handle user declining authorization
    if (error) {
      console.log('[integrations.jira.callback] User declined:', error)
      return redirectWithError('Jira authorization was declined.')
    }

    if (!code || !state) {
      return redirectWithError('Missing authorization code or state.')
    }

    // Decode and validate state
    let stateData: JiraOAuthState
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
    } catch {
      return redirectWithError('Invalid state parameter.')
    }

    const { projectId, userId, redirectUrl } = stateData

    if (!projectId || !userId) {
      return redirectWithError('Invalid state data.')
    }

    // Verify project ownership using admin client
    const adminSupabase = createAdminClient()
    const { data: project, error: projectError } = await adminSupabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return redirectWithError('Project not found.')
    }

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      return redirectWithError('Project access denied.')
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })

    // Get accessible resources to find the Jira cloud ID
    const resources = await getAccessibleResources(tokens.access_token)

    if (resources.length === 0) {
      return redirectWithError('No Jira sites found. Make sure you have access to a Jira Cloud site.')
    }

    // Use the first accessible resource
    const resource = resources[0]
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Store the connection
    const storeResult = await storeJiraConnection(adminSupabase, {
      projectId,
      cloudId: resource.id,
      siteUrl: resource.url,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
      installedByUserId: userId,
      installedByEmail: null, // Will be set when user configures
    })

    if (!storeResult.success) {
      return redirectWithError('Failed to save Jira connection.')
    }

    // Try to register webhook (non-blocking - failure is OK)
    const connection = {
      id: '', // Will be fetched
      project_id: projectId,
      cloud_id: resource.id,
      site_url: resource.url,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokenExpiresAt,
      jira_project_key: null,
      jira_project_id: null,
      issue_type_id: null,
      issue_type_name: null,
      is_enabled: true,
      auto_sync_enabled: true,
      installed_by_user_id: userId,
      installed_by_email: null,
      webhook_id: null,
      webhook_secret: null,
      created_at: '',
      updated_at: '',
    }

    const webhookResult = await registerJiraWebhook(connection)
    if (webhookResult) {
      // Store webhook info
      await adminSupabase
        .from('jira_connections')
        .update({
          webhook_id: webhookResult.webhookId,
          webhook_secret: webhookResult.webhookSecret,
        })
        .eq('project_id', projectId)
    }

    // Redirect back to integrations page
    const successUrl = redirectUrl || `${appUrl}/projects/${projectId}/integrations?jira=connected`
    return NextResponse.redirect(successUrl)
  } catch (error) {
    console.error('[integrations.jira.callback] unexpected error', error)
    return redirectWithError('An unexpected error occurred.')
  }
}

function redirectWithError(message: string): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const errorUrl = new URL('/projects', appUrl)
  errorUrl.searchParams.set('jira_error', message)
  return NextResponse.redirect(errorUrl.toString())
}
