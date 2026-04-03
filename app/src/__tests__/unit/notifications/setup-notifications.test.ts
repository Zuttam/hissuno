/**
 * Setup Notifications Tests
 *
 * Tests createProjectSetupNotifications.
 * Mocks the notification service to verify correct calls without database interaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MOCKS
// ============================================================================

const mockRecordNotification = vi.fn()

vi.mock('@/lib/notifications/notification-service', () => ({
  recordNotification: (...args: unknown[]) => mockRecordNotification(...args),
}))

// ============================================================================
// IMPORT UNDER TEST
// ============================================================================

import { createProjectSetupNotifications } from '@/lib/notifications/setup-notifications'

// ============================================================================
// HELPERS
// ============================================================================

const USER_ID = 'user-setup-1'
const PROJECT_ID = 'proj-setup-1'

beforeEach(() => {
  vi.clearAllMocks()
  mockRecordNotification.mockResolvedValue({ success: true, notificationId: 'n-1' })
})

// ============================================================================
// createProjectSetupNotifications
// ============================================================================

describe('createProjectSetupNotifications', () => {
  it('creates session sources notification always', async () => {
    await createProjectSetupNotifications(USER_ID, PROJECT_ID)

    expect(mockRecordNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        projectId: PROJECT_ID,
        type: 'setup_session_sources',
        channel: 'in_app',
        dedupKey: `setup_session_sources:${PROJECT_ID}`,
      })
    )
  })

  it('creates knowledge sources notification when hasKnowledgeSources is false', async () => {
    await createProjectSetupNotifications(USER_ID, PROJECT_ID, {
      hasKnowledgeSources: false,
    })

    expect(mockRecordNotification).toHaveBeenCalledTimes(2)
    expect(mockRecordNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'setup_knowledge_sources',
        dedupKey: `setup_knowledge_sources:${PROJECT_ID}`,
      })
    )
  })

  it('creates knowledge sources notification by default (no options)', async () => {
    await createProjectSetupNotifications(USER_ID, PROJECT_ID)

    expect(mockRecordNotification).toHaveBeenCalledTimes(2)
    expect(mockRecordNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'setup_knowledge_sources',
      })
    )
  })

  it('skips knowledge sources notification when hasKnowledgeSources is true', async () => {
    await createProjectSetupNotifications(USER_ID, PROJECT_ID, {
      hasKnowledgeSources: true,
    })

    expect(mockRecordNotification).toHaveBeenCalledTimes(1)
    expect(mockRecordNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'setup_session_sources',
      })
    )
  })

  it('catches errors without throwing', async () => {
    mockRecordNotification.mockRejectedValue(new Error('DB connection failed'))

    await expect(
      createProjectSetupNotifications(USER_ID, PROJECT_ID)
    ).resolves.toBeUndefined()
  })

  it('includes correct metadata in session sources notification', async () => {
    await createProjectSetupNotifications(USER_ID, PROJECT_ID)

    expect(mockRecordNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'setup_session_sources',
        metadata: expect.objectContaining({
          title: 'Connect a feedback source',
          link: `/projects/${PROJECT_ID}/integrations`,
          priority: 'high',
        }),
      })
    )
  })

  it('includes correct metadata in knowledge sources notification', async () => {
    await createProjectSetupNotifications(USER_ID, PROJECT_ID)

    expect(mockRecordNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'setup_knowledge_sources',
        metadata: expect.objectContaining({
          title: 'Add knowledge sources',
          link: `/projects/${PROJECT_ID}/agents`,
          priority: 'medium',
        }),
      })
    )
  })
})
