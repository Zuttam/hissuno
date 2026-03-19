import { NextRequest, NextResponse } from 'next/server'
import { LinearClient } from '@linear/sdk'
import { requireRequestIdentity } from '@/lib/auth/identity'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/linear/test
 * Test a Linear API key by fetching viewer + organization info
 */
export async function POST(request: NextRequest) {
  try {
    await requireRequestIdentity()

    const body = await request.json()
    const { apiKey } = body

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'apiKey is required' }, { status: 400 })
    }

    if (!apiKey.startsWith('lin_api_')) {
      return NextResponse.json(
        { error: 'Invalid API key format. Linear API keys start with lin_api_' },
        { status: 400 }
      )
    }

    const client = new LinearClient({ apiKey })
    const viewer = await client.viewer
    const org = await viewer.organization

    return NextResponse.json({
      success: true,
      organizationName: org.name,
      organizationId: org.id,
    })
  } catch (error) {
    console.error('[integrations.linear.test] Failed to validate API key:', error)
    return NextResponse.json(
      { error: 'Invalid API key or unable to connect to Linear.' },
      { status: 400 }
    )
  }
}
