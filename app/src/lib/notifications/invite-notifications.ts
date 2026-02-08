/**
 * Invite notification helpers
 *
 * Functions to send invite emails using the notification service
 * for deduplication and tracking.
 */

import { render } from '@react-email/components'
import { getResendClient, getFromAddress, isResendConfigured } from '@/lib/email/resend'
import { InviteEmail } from '@/lib/email/templates/invite'
import { recordNotification, hasNotificationBeenSent } from '@/lib/notifications/notification-service'
import type { SendEmailResult } from '@/lib/email/types'

const LOG_PREFIX = '[invite-notifications]'

/**
 * Dedup key for invite emails - one per invite per recipient
 */
function generateInviteDedupKey(inviteId: string, recipientEmail: string): string {
  return `invite_sent:${inviteId}:${recipientEmail}`
}

interface SendInviteEmailOptions {
  /** The sending user's ID (invite owner) */
  userId: string
  /** Invite record ID */
  inviteId: string
  /** Invite code to include in the email */
  inviteCode: string
  /** Recipient email address */
  recipientEmail: string
  /** Full signup URL with invite code */
  signupUrl: string
  /** Optional Lemon Squeezy promotion code */
  promotionCode?: string
  /** Optional description for the promotion (e.g. "$15 off your first month") */
  promotionDescription?: string
}

/**
 * Send invite email if not already sent to this recipient for this invite.
 */
export async function sendInviteEmailIfNeeded(
  options: SendInviteEmailOptions
): Promise<SendEmailResult> {
  const { userId, inviteId, inviteCode, recipientEmail, signupUrl, promotionCode, promotionDescription } = options
  const dedupKey = generateInviteDedupKey(inviteId, recipientEmail)

  try {
    // Check if already sent
    const alreadySent = await hasNotificationBeenSent(userId, dedupKey)
    if (alreadySent) {
      console.log(`${LOG_PREFIX} Invite email already sent for invite ${inviteId} to ${recipientEmail}`)
      return { success: false, error: 'Invite email already sent to this recipient.' }
    }

    if (!isResendConfigured()) {
      console.warn(`${LOG_PREFIX} Resend not configured, skipping email`)
      return { success: false, error: 'Email service not configured' }
    }

    const resend = getResendClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hissuno.com'
    const emailHtml = await render(InviteEmail({ inviteCode, signupUrl, appUrl, promotionCode, promotionDescription }))

    const { data: result, error: sendError } = await resend.emails.send({
      from: getFromAddress(),
      to: recipientEmail,
      subject: "You're invited to join Hissuno!",
      html: emailHtml,
    })

    if (sendError) {
      console.error(`${LOG_PREFIX} Failed to send email:`, sendError)
      return { success: false, error: sendError.message }
    }

    console.log(`${LOG_PREFIX} Sent invite email to ${recipientEmail}, messageId: ${result?.id}`)

    // Record the notification (prevents duplicates)
    await recordNotification({
      userId,
      type: 'invite_sent',
      channel: 'email',
      metadata: {
        inviteId,
        inviteCode,
        recipientEmail,
        messageId: result?.id,
      },
      dedupKey,
    })

    return { success: true, messageId: result?.id }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error sending invite email:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
