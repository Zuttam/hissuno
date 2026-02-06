/**
 * Generic notification service
 *
 * Provides centralized notification management with deduplication support.
 * Use this service to send and track notifications across the application.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { resolvePreferences, type NotificationType } from '@/types/notification-preferences'

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
  /** Notification type (e.g., 'limit_reached', 'welcome') */
  type: string
  /** Delivery channel */
  channel?: NotificationChannel
  /** Flexible metadata payload */
  metadata?: Record<string, unknown>
  /**
   * Deduplication key - prevents duplicate notifications if set.
   * Example: 'limit_reached:sessions:2026-01' prevents duplicate per billing period
   */
  dedupKey?: string
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
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('user_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('dedup_key', dedupKey)
    .single()

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
  const { userId, type, channel = 'email', metadata = {}, dedupKey } = options
  const supabase = createAdminClient()

  // Check for duplicate if dedup key is provided
  if (dedupKey) {
    const alreadySent = await hasNotificationBeenSent(userId, dedupKey)
    if (alreadySent) {
      console.log(`${LOG_PREFIX} Notification already sent (dedup: ${dedupKey})`)
      return { success: true, skipped: true }
    }
  }

  // Insert notification record
  const { data, error } = await supabase
    .from('user_notifications')
    .insert({
      user_id: userId,
      type,
      channel,
      metadata,
      dedup_key: dedupKey ?? null,
    })
    .select('id')
    .single()

  if (error) {
    // Handle unique constraint violation (race condition)
    if (error.code === '23505') {
      console.log(`${LOG_PREFIX} Notification already sent (race condition, dedup: ${dedupKey})`)
      return { success: true, skipped: true }
    }

    console.error(`${LOG_PREFIX} Failed to record notification:`, error)
    return { success: false, error: error.message }
  }

  console.log(`${LOG_PREFIX} Recorded notification: type=${type}, channel=${channel}, id=${data.id}`)
  return { success: true, notificationId: data.id }
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
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('user_profiles')
    .select('notifications_silenced, notification_preferences')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    // If we can't read preferences, default to allowing email, blocking slack
    console.warn(`${LOG_PREFIX} Could not read notification preferences for user ${userId}`)
    return channel === 'email'
  }

  if (data.notifications_silenced) {
    return false
  }

  const preferences = resolvePreferences(data.notification_preferences)
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
  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.getUserById(userId)

  if (error || !data.user) {
    console.error(`${LOG_PREFIX} Failed to get user email:`, error)
    return null
  }

  return data.user.email ?? null
}

/**
 * Get user profile info by ID
 */
export async function getUserProfile(
  userId: string
): Promise<{ email: string | null; fullName: string | null }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.getUserById(userId)

  if (error || !data.user) {
    console.error(`${LOG_PREFIX} Failed to get user:`, error)
    return { email: null, fullName: null }
  }

  return {
    email: data.user.email ?? null,
    fullName: data.user.user_metadata?.full_name ?? null,
  }
}
