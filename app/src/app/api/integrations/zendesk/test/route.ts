/**
 * Zendesk test connection API route.
 * POST - Test credentials without storing them
 */

import { NextRequest, NextResponse } from 'next/server'
import { ZendeskClient, ZendeskApiError } from '@/lib/integrations/zendesk/client'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/zendesk/test
 * Test Zendesk credentials by calling the /users/me endpoint
 */
export async function POST(request: NextRequest) {
  try {
    await requireRequestIdentity()

    const body = await request.json()
    const { subdomain, email, apiToken } = body as {
      subdomain: string
      email: string
      apiToken: string
    }

    if (!subdomain || !email || !apiToken) {
      return NextResponse.json({ error: 'subdomain, email, and apiToken are required.' }, { status: 400 })
    }

    const client = new ZendeskClient(subdomain.trim(), email.trim(), apiToken.trim())

    try {
      const result = await client.testConnection()
      return NextResponse.json({
        success: true,
        accountName: result.name,
      })
    } catch (error) {
      if (error instanceof ZendeskApiError) {
        if (error.statusCode === 401) {
          return NextResponse.json({ error: 'Invalid credentials.' }, { status: 400 })
        }
        return NextResponse.json(
          { error: `Zendesk API error: ${error.message}` },
          { status: 400 }
        )
      }
      throw error
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[integrations.zendesk.test] unexpected error', error)
    return NextResponse.json({ error: 'Failed to test connection.' }, { status: 500 })
  }
}
