import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { createDemoProjectData } from '@/lib/demo/demo-data-service'
import { createProjectSetupNotifications } from '@/lib/notifications/setup-notifications'
import type { Database } from '@/types/supabase'
import {
  createClient,
  isSupabaseConfigured,
} from '@/lib/supabase/server'

export const runtime = 'nodejs'

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

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
    const { supabase, user } = await resolveUser()

    // Guard: only one demo project per user
    const { count: existingDemoCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_demo', true)

    if (existingDemoCount && existingDemoCount > 0) {
      return NextResponse.json({ error: 'You already have a demo project.' }, { status: 409 })
    }

    const id = randomUUID()

    const projectInsert: Database['public']['Tables']['projects']['Insert'] = {
      id,
      name: 'Demo Project',
      description: 'A pre-built project with sample data to help you explore Hissuno.',
      user_id: user.id,
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
    void createProjectSetupNotifications(user.id, id, {
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
