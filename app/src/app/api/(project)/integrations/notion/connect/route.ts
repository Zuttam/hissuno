/**
 * Notion connect API route.
 * GET - Initiate OAuth flow (redirect to Notion)
 * POST - Connect via Internal Integration Token
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getNotionOAuthUrl } from '@/lib/integrations/notion/oauth'
import { NotionClient } from '@/lib/integrations/notion/client'
import { storeNotionToken } from '@/lib/integrations/notion'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/notion/connect?projectId=xxx
 * Initiates Notion OAuth flow
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.notion.connect] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const clientId = process.env.NOTION_CLIENT_ID
  const clientSecret = process.env.NOTION_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/notion/callback`

  if (!clientId || !clientSecret) {
    console.error('[integrations.notion.connect] Missing NOTION_CLIENT_ID or NOTION_CLIENT_SECRET')
    return NextResponse.json({ error: 'Notion OAuth not configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Generate HMAC-signed state for CSRF protection
    const redirectUrl = `/projects/${projectId}/integrations?notion=connected`

    const payload = Buffer.from(
      JSON.stringify({
        projectId,
        userId: identity.type === 'user' ? identity.userId : identity.createdByUserId,
        redirectUrl,
      })
    ).toString('base64url')
    const signature = crypto.createHmac('sha256', clientSecret).update(payload).digest('base64url')
    const state = `${payload}.${signature}`

    const oauthUrl = getNotionOAuthUrl({
      clientId,
      redirectUri,
      state,
    })

    return NextResponse.redirect(oauthUrl)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.notion.connect] OAuth initiation error', error)
    return NextResponse.json({ error: 'Failed to initiate Notion connection.' }, { status: 500 })
  }
}

/**
 * POST /api/integrations/notion/connect
 * Connect Notion via Internal Integration Token
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    const body = await request.json()
    const { projectId, accessToken } = body as { projectId?: string; accessToken?: string }

    if (!projectId || !accessToken) {
      return NextResponse.json({ error: 'projectId and accessToken are required' }, { status: 400 })
    }

    await assertProjectAccess(identity, projectId)

    // Validate the token by calling Notion API
    const client = new NotionClient(accessToken)
    let botInfo: { botId: string; name: string }
    try {
      botInfo = await client.testConnection()
    } catch {
      return NextResponse.json(
        { error: 'Invalid token. Please check your Notion Internal Integration Token.' },
        { status: 400 }
      )
    }

    const result = await storeNotionToken({
      projectId,
      accessToken,
      workspaceName: botInfo.name,
      botId: botInfo.botId,
      installedByUserId: identity.type === 'user' ? identity.userId : identity.createdByUserId,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, workspaceName: botInfo.name })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.notion.connect.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to connect Notion.' }, { status: 500 })
  }
}
