/**
 * Limit notification helpers
 *
 * Functions to send notifications when users reach their subscription limits.
 */

import { render } from '@react-email/components'
import { getResendClient, getFromAddress, isResendConfigured } from '@/lib/email/resend'
import { LimitReachedEmail } from '@/lib/email/templates/limit-reached'
import {
  recordNotification,
  hasNotificationBeenSent,
  getUserProfile,
} from '@/lib/notifications/notification-service'
import { getBillingInfo } from '@/lib/billing/billing-service'
import type { EnforcementResult, LimitDimension } from '@/lib/billing/enforcement-types'

const LOG_PREFIX = '[limit-notifications]'

/**
 * Generate a dedup key for limit notifications
 * Format: limit_reached:{dimension}:{period_start_month}
 */
function generateDedupKey(dimension: LimitDimension, periodStart: string): string {
  // Extract YYYY-MM from period start
  const period = periodStart.slice(0, 7)
  return `limit_reached:${dimension}:${period}`
}

/**
 * Send limit reached notification if not already sent this billing period.
 *
 * This function is designed to be called in a fire-and-forget manner
 * from the enforcement service when a limit is exceeded.
 */
export async function sendLimitNotificationIfNeeded(
  userId: string,
  result: EnforcementResult
): Promise<void> {
  // Only send for over-limit results
  if (!result.isOverLimit || result.limit === null) {
    return
  }

  try {
    // Get billing info to determine period
    const billingInfo = await getBillingInfo(userId)
    const periodStart = billingInfo.usage.periodStart

    // Generate dedup key
    const dedupKey = generateDedupKey(result.dimension, periodStart)

    // Check if already sent (quick check before doing more work)
    const alreadySent = await hasNotificationBeenSent(userId, dedupKey)
    if (alreadySent) {
      console.log(`${LOG_PREFIX} Notification already sent for ${dedupKey}`)
      return
    }

    // Get user profile for email
    const { email, fullName } = await getUserProfile(userId)
    if (!email) {
      console.warn(`${LOG_PREFIX} No email for user ${userId}, skipping notification`)
      return
    }

    // Send email if Resend is configured
    if (isResendConfigured()) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.hissuno.com'
      const upgradeUrl = `${appUrl}/account/billing`

      try {
        const resend = getResendClient()

        // Pre-render to HTML to avoid Resend's internal rendering issues with Next.js bundling
        const emailHtml = await render(
          LimitReachedEmail({
            fullName,
            dimension: result.dimension,
            current: result.current,
            limit: result.limit,
            upgradeUrl,
          })
        )

        const res = await resend.emails.send({
          from: getFromAddress(),
          to: email,
          subject: `You've reached your ${result.dimension} limit on Hissuno`,
          html: emailHtml,
        })

        console.debug(`${LOG_PREFIX} Resend response:`, res)

        console.log(`${LOG_PREFIX} Sent limit reached email to ${email}`)
      } catch (emailError) {
        console.error(`${LOG_PREFIX} Failed to send email:`, emailError)
        // Continue to record notification even if email fails
      }
    } else {
      console.warn(`${LOG_PREFIX} Resend not configured, skipping email`)
    }

    // Record the notification (prevents duplicates)
    await recordNotification({
      userId,
      type: 'limit_reached',
      channel: 'email',
      metadata: {
        dimension: result.dimension,
        current: result.current,
        limit: result.limit,
        periodStart,
      },
      dedupKey,
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error sending limit notification:`, error)
    // Don't throw - this is a best-effort notification
  }
}
