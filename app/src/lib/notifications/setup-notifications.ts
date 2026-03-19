import { recordNotification } from '@/lib/notifications/notification-service'

const LOG_PREFIX = '[setup-notifications]'

interface CreateProjectSetupOptions {
  hasKnowledgeSources?: boolean
}

/**
 * Create in-app setup notifications for a newly created project.
 * Best-effort — catches errors and does not throw.
 */
export async function createProjectSetupNotifications(
  userId: string,
  projectId: string,
  options: CreateProjectSetupOptions = {}
): Promise<void> {
  const { hasKnowledgeSources = false } = options

  try {
    // Always create session sources notification
    await recordNotification({
      userId,
      projectId,
      type: 'setup_session_sources',
      channel: 'in_app',
      dedupKey: `setup_session_sources:${projectId}`,
      metadata: {
        title: 'Connect a feedback source',
        message: 'Set up an integration to start collecting customer conversations.',
        link: `/projects/${projectId}/integrations`,
        priority: 'high',
      },
    })

    // Skip knowledge sources notification if already configured
    if (!hasKnowledgeSources) {
      await recordNotification({
        userId,
        projectId,
        type: 'setup_knowledge_sources',
        channel: 'in_app',
        dedupKey: `setup_knowledge_sources:${projectId}`,
        metadata: {
          title: 'Add knowledge sources',
          message: 'Add knowledge sources to empower your agents.',
          link: `/projects/${projectId}/agents`,
          priority: 'medium',
        },
      })
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to create setup notifications:`, error)
  }
}
