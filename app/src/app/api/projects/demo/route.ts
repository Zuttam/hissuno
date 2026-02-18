import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { addProjectMember } from '@/lib/auth/project-members'
import { createDemoProjectData } from '@/lib/demo/demo-data-service'
import { createProjectSetupNotifications } from '@/lib/notifications/setup-notifications'
import type { Database } from '@/types/supabase'
import {
  createAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/projects/demo
 * Creates a demo project with pre-populated data.
 * Skips subscription project limit (demo projects are free).
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    if (identity.type !== 'user') {
      return NextResponse.json({ error: 'API keys cannot create demo projects.' }, { status: 403 })
    }
    const supabase = createAdminClient()

    // Guard: only one demo project per user
    const { count: existingDemoCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', identity.userId)
      .eq('is_demo', true)

    if (existingDemoCount && existingDemoCount > 0) {
      return NextResponse.json({ error: 'You already have a demo project.' }, { status: 409 })
    }

    const id = randomUUID()

    const projectInsert: Database['public']['Tables']['projects']['Insert'] = {
      id,
      name: 'Demo Project',
      description: 'A pre-built project with sample data to help you explore Hissuno.',
      user_id: identity.userId,
      is_demo: true,
    }

    const { data: createdProject, error: projectInsertError } = await supabase
      .from('projects')
      .insert(projectInsert)
      .select('*')
      .single()

    if (projectInsertError || !createdProject) {
      console.error('[projects.demo.post] failed to create demo project', projectInsertError)
      return NextResponse.json({ error: 'Failed to create demo project.' }, { status: 500 })
    }

    // Add the user as the project owner
    await addProjectMember({
      projectId: id,
      userId: identity.userId,
      role: 'owner',
      status: 'active',
    })

    // Populate demo data (sessions, issues, companies, contacts)
    try {
      const result = await createDemoProjectData({
        projectId: id,
        supabase,
      })

      console.log('[projects.demo.post] demo data created:', result)
    } catch (err) {
      console.error('[projects.demo.post] failed to populate demo data:', err)
      // Non-critical — project still exists, just empty
    }

    // Create setup notifications (fire-and-forget)
    void createProjectSetupNotifications(identity.userId, id, {
      hasKnowledgeSources: false,
    }).catch((err) => console.error('[projects.demo.post] setup notifications error:', err))

    return NextResponse.json({ project: createdProject })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[projects.demo.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create demo project.' }, { status: 500 })
  }
}
