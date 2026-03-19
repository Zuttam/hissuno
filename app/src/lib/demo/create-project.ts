/**
 * Shared project + demo data creation.
 *
 * Used by both the seed script (`npm run seed`) and the demo API route
 * so every path produces the same rich demo data.
 */

import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { projects, projectSettings, widgetIntegrations } from '@/lib/db/schema/app'
import { addProjectMember } from '@/lib/auth/project-members'
import { createDemoProjectData } from '@/lib/demo/demo-data-service'
import { createProjectSetupNotifications } from '@/lib/notifications/setup-notifications'

export async function createProjectWithDemoData(params: {
  projectId?: string
  projectName?: string
  projectDescription?: string
  userId: string
  isDemoProject?: boolean
}): Promise<{
  project: typeof projects.$inferSelect
  demoStats: Awaited<ReturnType<typeof createDemoProjectData>>
}> {
  const {
    projectId = randomUUID(),
    projectName = 'Demo Project',
    projectDescription = 'A pre-built project with sample data to help you explore Hissuno.',
    userId,
    isDemoProject = false,
  } = params

  // 1. Create project
  const [project] = await db
    .insert(projects)
    .values({
      id: projectId,
      name: projectName,
      description: projectDescription,
      user_id: userId,
      is_demo: isDemoProject,
    })
    .onConflictDoUpdate({
      target: projects.id,
      set: {
        name: projectName,
        description: projectDescription,
        user_id: userId,
        updated_at: new Date(),
      },
    })
    .returning()

  if (!project) {
    throw new Error('Failed to create project')
  }

  // 2. Project settings
  await db
    .insert(projectSettings)
    .values({
      project_id: projectId,
      session_idle_timeout_minutes: 5,
      session_goodbye_delay_seconds: 90,
      session_idle_response_timeout_seconds: 60,
      issue_tracking_enabled: true,
    })
    .onConflictDoUpdate({
      target: projectSettings.project_id,
      set: {
        session_idle_timeout_minutes: 5,
        session_goodbye_delay_seconds: 90,
        session_idle_response_timeout_seconds: 60,
        issue_tracking_enabled: true,
        updated_at: new Date(),
      },
    })

  // 3. Widget integration
  await db
    .insert(widgetIntegrations)
    .values({
      project_id: projectId,
      variant: 'sidepanel',
      theme: 'light',
      position: 'bottom-right',
      title: 'Support',
      initial_message: 'Hi! How can I help you today?',
      token_required: false,
      allowed_origins: ['localhost:3000', 'hissuno.com', '*.hissuno.com'],
    })
    .onConflictDoUpdate({
      target: widgetIntegrations.project_id,
      set: {
        variant: 'sidepanel',
        theme: 'light',
        position: 'bottom-right',
        title: 'Support',
        initial_message: 'Hi! How can I help you today?',
        token_required: false,
        allowed_origins: ['localhost:3000', 'hissuno.com', '*.hissuno.com'],
        updated_at: new Date(),
      },
    })

  // 4. Add user as project owner
  await addProjectMember({
    projectId,
    userId,
    role: 'owner',
    status: 'active',
  })

  // 5. Populate demo data (sessions, issues, companies, contacts, etc.)
  const demoStats = await createDemoProjectData({ projectId })

  // 6. Setup notifications (fire-and-forget)
  void createProjectSetupNotifications(userId, projectId, {
    hasKnowledgeSources: true,
  }).catch((err) => console.error('[create-project] setup notifications error:', err))

  return { project, demoStats }
}
