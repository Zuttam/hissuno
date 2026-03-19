/**
 * Generic notification service
 *
 * Provides centralized notification management with deduplication support.
 * Use this service to send and track notifications across the application.
 */

import { db } from '@/lib/db'
import { isUniqueViolation } from '@/lib/db/errors'
import { userNotifications, userProfiles } from '@/lib/db/schema/app'
import { users } from '@/lib/db/schema/auth'
import { eq, and } from 'drizzle-orm'
import { resolvePreferences, type NotificationType, type NotificationPreferences } from '@/types/notification-preferences'

const LOG_PREFIX = '[notification-service]'

/**
 * Notification channel types
 */
export type NotificationChannel = 'email' | 'in_app' | 'slack'

/**
 * Options for sending a notification
 */
export interface SendNotificationOptions {
  /** User to send notification to */
  userId: string
  /** Notification type (e.g., 'human_needed', 'session_reviewed') */
  type: string
  /** Delivery channel */
  channel?: NotificationChannel
  /** Flexible metadata payload */
  metadata?: Record<string, unknown>
  /**
   * Deduplication key - prevents duplicate notifications if set.
   * Example: 'human_needed:session:abc123' prevents duplicate per session
   */
  dedupKey?: string
  /** Optional project scope */
  projectId?: string
}

/**
 * Result of sending a notification
 */
export interface NotificationResult {
  /** Whether the notification was sent/recorded successfully */
  success: boolean
  /** True if notification was skipped due to deduplication */
  skipped?: boolean
  /** Error message if failed */
  error?: string
  /** Notification record ID if created */
  notificationId?: string
}

/**
 * Check if a notification with the given dedup key has already been sent
 */
export async function hasNotificationBeenSent(
  userId: string,
  dedupKey: string
): Promise<boolean> {
  const [data] = await db
    .select({ id: userNotifications.id })
    .from(userNotifications)
    .where(
      and(
        eq(userNotifications.user_id, userId),
        eq(userNotifications.dedup_key, dedupKey)
      )
    )
    .limit(1)

  return !!data
}

/**
 * Record a notification in the database
 *
 * This function only records the notification - actual delivery (email, etc.)
 * should be handled by the caller before or after calling this.
 */
export async function recordNotification(
  options: SendNotificationOptions
): Promise<NotificationResult> {
  const { userId, type, channel = 'email', metadata = {}, dedupKey, projectId } = options

  // Check for duplicate if dedup key is provided
  if (dedupKey) {
    const alreadySent = await hasNotificationBeenSent(userId, dedupKey)
    if (alreadySent) {
      console.log(`${LOG_PREFIX} Notification already sent (dedup: ${dedupKey})`)
      return { success: true, skipped: true }
    }
  }

  // Insert notification record
  try {
    const [data] = await db
      .insert(userNotifications)
      .values({
        user_id: userId,
        type,
        channel,
        metadata,
        dedup_key: dedupKey ?? null,
        project_id: projectId ?? null,
      })
      .returning({ id: userNotifications.id })

    if (!data) {
      console.error(`${LOG_PREFIX} Failed to record notification`)
      return { success: false, error: 'Failed to insert notification record.' }
    }

    console.log(`${LOG_PREFIX} Recorded notification: type=${type}, channel=${channel}, id=${data.id}`)
    return { success: true, notificationId: data.id }
  } catch (error) {
    // Handle unique constraint violation (race condition)
    if (isUniqueViolation(error)) {
      console.log(`${LOG_PREFIX} Notification already sent (race condition, dedup: ${dedupKey})`)
      return { success: true, skipped: true }
    }

    console.error(`${LOG_PREFIX} Failed to record notification:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Check if a notification should be sent based on user preferences.
 * Returns false if notifications are silenced or the specific type/channel is disabled.
 */
export async function shouldSendNotification(
  userId: string,
  type: NotificationType,
  channel: 'email' | 'slack'
): Promise<boolean> {
  const [data] = await db
    .select({
      notifications_silenced: userProfiles.notifications_silenced,
      notification_preferences: userProfiles.notification_preferences,
    })
    .from(userProfiles)
    .where(eq(userProfiles.user_id, userId))
    .limit(1)

  if (!data) {
    // If we can't read preferences, default to allowing email, blocking slack
    console.warn(`${LOG_PREFIX} Could not read notification preferences for user ${userId}`)
    return channel === 'email'
  }

  if (data.notifications_silenced) {
    return false
  }

  const preferences = resolvePreferences(data.notification_preferences as NotificationPreferences | null)
  const pref = preferences[type]
  if (!pref) {
    return channel === 'email'
  }

  return pref[channel] ?? false
}

/**
 * Get user email by ID
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    console.error(`${LOG_PREFIX} Failed to get user email for ${userId}`)
    return null
  }

  return user.email
}

/**
 * Get user profile info by ID
 */
export async function getUserProfile(
  userId: string
): Promise<{ email: string | null; fullName: string | null }> {
  const [user] = await db
    .select({ email: users.email, fullName: userProfiles.full_name })
    .from(users)
    .leftJoin(userProfiles, eq(users.id, userProfiles.user_id))
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    console.error(`${LOG_PREFIX} Failed to get user for ${userId}`)
    return { email: null, fullName: null }
  }

  return {
    email: user.email,
    fullName: user.fullName ?? null,
  }
}
