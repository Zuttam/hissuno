/**
 * Welcome notification helpers
 *
 * Functions to send welcome emails to new users using the notification service.
 */

import { render } from '@react-email/components'
import { getResendClient, getFromAddress, isResendConfigured } from '@/lib/email/resend'
import { WelcomeEmail } from '@/lib/email/templates/welcome'
import { recordNotification, hasNotificationBeenSent } from '@/lib/notifications/notification-service'
import type { SendEmailResult } from '@/lib/email/types'

const LOG_PREFIX = '[welcome-notifications]'

/**
 * Dedup key for welcome emails - one per user ever
 */
function generateWelcomeDedupKey(): string {
  return 'welcome:onboarding'
}

/**
 * Send welcome email if not already sent.
 */
export async function sendWelcomeNotificationIfNeeded(
  userId: string,
  email: string,
  fullName?: string | null
): Promise<SendEmailResult> {
  const dedupKey = generateWelcomeDedupKey()

  try {
    // Check if already sent
    const alreadySent = await hasNotificationBeenSent(userId, dedupKey)
    if (alreadySent) {
      console.log(`${LOG_PREFIX} Welcome notification already sent for user ${userId}`)
      return { success: true, error: 'Already sent' }
    }

    // Send email if Resend is configured
    if (!isResendConfigured()) {
      console.warn(`${LOG_PREFIX} Resend not configured, skipping email`)
      return { success: false, error: 'Email service not configured' }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.hissuno.com'
    const dashboardUrl = `${appUrl}/projects`

    try {
      const resend = getResendClient()
      const emailHtml = await render(WelcomeEmail({ fullName, dashboardUrl }))

      const { data: result, error: sendError } = await resend.emails.send({
        from: getFromAddress(),
        to: email,
        subject: 'Welcome to Hissuno!',
        html: emailHtml,
      })

      if (sendError) {
        console.error(`${LOG_PREFIX} Failed to send email:`, sendError)
        return { success: false, error: sendError.message }
      }

      console.log(`${LOG_PREFIX} Sent welcome email to ${email}, messageId: ${result?.id}`)

      // Record the notification (prevents duplicates)
      await recordNotification({
        userId,
        type: 'welcome',
        channel: 'email',
        metadata: {
          recipientEmail: email,
          messageId: result?.id,
        },
        dedupKey,
      })

      return { success: true, messageId: result?.id }
    } catch (emailError) {
      console.error(`${LOG_PREFIX} Failed to send email:`, emailError)
      return {
        success: false,
        error: emailError instanceof Error ? emailError.message : 'Unknown error',
      }
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error sending welcome notification:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
