import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError, getSafeRedirectPath } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { storeGitHubPAT } from '@/lib/integrations/github'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/github/connect?projectId=xxx
 * Initiates GitHub App installation flow
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.github.connect] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const appSlug = process.env.GITHUB_APP_SLUG
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY

  if (!appSlug || !privateKey) {
    console.error('[integrations.github.connect] Missing GITHUB_APP_SLUG or GITHUB_APP_PRIVATE_KEY configuration')
    return NextResponse.json({ error: 'GitHub integration not configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()

    // Get query params
    const projectId = request.nextUrl.searchParams.get('projectId')
    const nextUrl = request.nextUrl.searchParams.get('nextUrl')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    await assertProjectAccess(identity, projectId)

    // Generate state with projectId and full redirectUrl for CSRF protection
    const nonce = crypto.randomUUID()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Determine redirect path - use explicit nextUrl if provided and valid
    let finalRedirectPath: string
    if (nextUrl) {
      const safePath = getSafeRedirectPath(nextUrl)
      // Security: ensure returnUrl is for the same project
      if (safePath.includes(projectId)) {
        const url = new URL(safePath, appUrl)
        if (!url.searchParams.has('github')) {
          url.searchParams.set('github', 'connected')
        }
        finalRedirectPath = `${url.pathname}${url.search}`
      } else {
        // Fallback to agents page if nextUrl doesn't match project
        finalRedirectPath = `/projects/${projectId}/agents?github=connected`
      }
    } else {
      finalRedirectPath = `/projects/${projectId}/integrations?github=connected`
    }

    // Generate HMAC-signed state for CSRF protection
    const statePayload = Buffer.from(
      JSON.stringify({
        projectId,
        userId: identity.userId,
        nonce,
        redirectUrl: finalRedirectPath,
      })
    ).toString('base64url')
    const signature = crypto.createHmac('sha256', privateKey).update(statePayload).digest('base64url')
    const state = `${statePayload}.${signature}`

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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.github.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to initiate GitHub connection.' }, { status: 500 })
  }
}

/**
 * POST /api/integrations/github/connect
 * Connect GitHub via Personal Access Token
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()
    const body = await request.json()
    const { projectId, accessToken } = body as { projectId?: string; accessToken?: string }

    if (!projectId || !accessToken) {
      return NextResponse.json({ error: 'projectId and accessToken are required' }, { status: 400 })
    }

    await assertProjectAccess(identity, projectId)

    // Validate PAT by calling GitHub API
    const ghResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!ghResponse.ok) {
      return NextResponse.json({ error: 'Invalid token. Please check your Personal Access Token.' }, { status: 400 })
    }

    const ghUser = await ghResponse.json() as { login: string; id: number }

    const result = await storeGitHubPAT({
      projectId,
      accessToken,
      accountLogin: ghUser.login,
      accountId: ghUser.id,
      installedByUserId: identity.userId,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, accountLogin: ghUser.login })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.github.connect.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to connect GitHub.' }, { status: 500 })
  }
}
