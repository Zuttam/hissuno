/**
 * Project invite notification helpers
 *
 * Sends project invite emails using the notification service for dedup and tracking.
 */

import { render } from '@react-email/components'
import { getResendClient, getFromAddress, isResendConfigured } from '@/lib/email/resend'
import { ProjectInviteEmail } from '@/lib/email/templates/project-invite'
import { recordNotification, hasNotificationBeenSent } from '@/lib/notifications/notification-service'
import type { SendEmailResult } from '@/lib/email/types'

const LOG_PREFIX = '[project-invite-notifications]'

function generateDedupKey(memberId: string, recipientEmail: string): string {
  return `project_invite:${memberId}:${recipientEmail}`
}

interface SendProjectInviteEmailOptions {
  /** User ID of the person sending the invite (project owner) */
  inviterUserId: string
  /** Display name of the inviter */
  inviterName: string | null
  /** Project member record ID */
  memberId: string
  /** Name of the project being invited to */
  projectName: string
  /** Recipient email address */
  recipientEmail: string
  /** Whether the recipient is a new user (not yet on Hissuno) */
  isNewUser: boolean
  /** Temporary password for new users (plaintext, shown in email) */
  temporaryPassword?: string
}

export async function sendProjectInviteEmailIfNeeded(
  options: SendProjectInviteEmailOptions
): Promise<SendEmailResult> {
  const {
    inviterUserId,
    inviterName,
    memberId,
    projectName,
    recipientEmail,
    isNewUser,
    temporaryPassword,
  } = options

  const dedupKey = generateDedupKey(memberId, recipientEmail)

  try {
    const alreadySent = await hasNotificationBeenSent(inviterUserId, dedupKey)
    if (alreadySent) {
      console.log(`${LOG_PREFIX} Project invite email already sent for member ${memberId}`)
      return { success: false, error: 'Project invite email already sent.' }
    }

    if (!isResendConfigured()) {
      console.warn(`${LOG_PREFIX} Resend not configured, skipping email`)
      return { success: false, error: 'Email service not configured' }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hissuno.com'
    const acceptUrl = `${appUrl}/projects?acceptInvite=${memberId}`

    const resend = getResendClient()
    const emailHtml = await render(
      ProjectInviteEmail({
        projectName,
        inviterName,
        acceptUrl,
        isNewUser,
        temporaryPassword,
        recipientEmail,
      })
    )

    const { data: result, error: sendError } = await resend.emails.send({
      from: getFromAddress(),
      to: recipientEmail,
      subject: `You've been invited to ${projectName} on Hissuno`,
      html: emailHtml,
    })

    if (sendError) {
      console.error(`${LOG_PREFIX} Failed to send email:`, sendError)
      return { success: false, error: sendError.message }
    }

    console.log(`${LOG_PREFIX} Sent project invite email to ${recipientEmail}, messageId: ${result?.id}`)

    await recordNotification({
      userId: inviterUserId,
      type: 'project_invite_sent',
      channel: 'email',
      metadata: {
        memberId,
        projectName,
        recipientEmail,
        isNewUser,
        messageId: result?.id,
      },
      dedupKey,
    })

    return { success: true, messageId: result?.id }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error sending project invite email:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
