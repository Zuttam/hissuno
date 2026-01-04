import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateWidgetJWT } from '@/lib/utils/widget-auth'
import { getProjectById } from '@/lib/projects/keys'
import { HISSUNO_SUPPORT_PROJECT_ID } from '@/lib/consts'

/**
 * GET /api/widget-token
 *
 * Generate a widget JWT token for the authenticated user.
 * Used by the internal Hissuno support widget.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the support project's secret key
    const project = await getProjectById(HISSUNO_SUPPORT_PROJECT_ID)
    if (!project?.secret_key) {
      console.error('[widget-token] Support project not found or missing secret key')
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }

    // Generate JWT token for the user
    const token = generateWidgetJWT(
      {
        userId: user.id,
        userMetadata: {
          email: user.email ?? '',
          ...(user.user_metadata?.full_name && { name: user.user_metadata.full_name }),
        },
      },
      project.secret_key,
      '24h'
    )

    return NextResponse.json({ token })
  } catch (error) {
    console.error('[widget-token] unexpected error', error)
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}
