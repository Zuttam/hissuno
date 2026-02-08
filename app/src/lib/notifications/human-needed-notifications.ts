/**
 * Human needed notification helpers
 *
 * Sends notifications when a session requires human intervention.
 * For Slack: sends an interactive DM that allows replying to the customer.
 */

import { render } from '@react-email/components'
import { getResendClient, getFromAddress, isResendConfigured } from '@/lib/email/resend'
import { HumanNeededEmail } from '@/lib/email/templates/human-needed'
import { createAdminClient } from '@/lib/supabase/server'
import { recordNotification, shouldSendNotification, getUserProfile } from './notification-service'
import { resolveSlackUserId, sendSlackDM } from './slack-notifications'
import { setSessionHumanTakeoverNotification } from '@/lib/integrations/slack'

const LOG_PREFIX = '[human-needed-notifications]'

interface SendHumanNeededNotificationParams {
  sessionId: string
  projectId: string
  sessionName?: string | null
}

/**
 * Send human needed notification to project owner.
 *
 * This function is designed to be called in a fire-and-forget manner
 * when a session enters human takeover mode.
 */
export async function sendHumanNeededNotification(
  params: SendHumanNeededNotificationParams
): Promise<void> {
  const { sessionId, projectId, sessionName } = params

  try {
    const supabase = createAdminClient()

    // Get project owner
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      console.error(`${LOG_PREFIX} Could not find project ${projectId}`)
      return
    }

    const userId = project.user_id
    const projectName = project.name

    // Dedup key based on session ID (one notification per session)
    const dedupKey = `human_needed:${sessionId}`

    // Get user profile for email
    const { email, fullName } = await getUserProfile(userId)
    if (!email) {
      console.warn(`${LOG_PREFIX} No email for user ${userId}, skipping notification`)
      return
    }

    // Build session URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hissuno.com'
    const sessionUrl = `${appUrl}/projects/${projectId}/sessions?sessionId=${sessionId}`

    // Check email preference and send if allowed
    const shouldEmail = await shouldSendNotification(userId, 'human_needed', 'email')
    if (shouldEmail && isResendConfigured()) {
      try {
        const resend = getResendClient()

        // Pre-render to HTML
        const emailHtml = await render(
          HumanNeededEmail({
            fullName,
            sessionName,
            sessionId,
            projectName,
            sessionUrl,
          })
        )

        const res = await resend.emails.send({
          from: getFromAddress(),
          to: email,
          subject: 'A customer conversation needs your attention',
          html: emailHtml,
        })

        console.debug(`${LOG_PREFIX} Resend response:`, res)
        console.log(`${LOG_PREFIX} Sent human needed email to ${email}`)

        // Record the email notification
        await recordNotification({
          userId,
          type: 'human_needed',
          channel: 'email',
          metadata: {
            sessionId,
            projectId,
            sessionName,
          },
          dedupKey: `${dedupKey}:email`,
        })
      } catch (emailError) {
        console.error(`${LOG_PREFIX} Failed to send email:`, emailError)
      }
    } else if (!shouldEmail) {
      console.log(`${LOG_PREFIX} Email notification disabled by user preferences`)
    } else {
      console.log(`${LOG_PREFIX} Resend not configured, skipping email`)
    }

    // Check Slack preference and send if allowed
    const shouldSlack = await shouldSendNotification(userId, 'human_needed', 'slack')
    if (shouldSlack) {
      try {
        // Resolve user's Slack ID and get bot token
        const slackInfo = await resolveSlackUserId(userId)

        if (!slackInfo) {
          console.log(`${LOG_PREFIX} Could not resolve Slack user for ${userId}`)
          return
        }

        // Build Slack message with session context
        const displayName = sessionName || `Session ${sessionId.slice(0, 8)}`
        const slackText = [
          `*A customer conversation needs your attention*`,
          ``,
          `*Session:* ${displayName}`,
          projectName ? `*Project:* ${projectName}` : null,
          ``,
          `The AI support agent has flagged this session for human takeover.`,
          ``,
          `*Reply to this message* to respond directly to the customer, or <${sessionUrl}|view in Hissuno>.`,
        ]
          .filter(Boolean)
          .join('\n')

        const slackResult = await sendSlackDM({
          slackUserId: slackInfo.slackUserId,
          botToken: slackInfo.botToken,
          text: slackText,
        })

        if (slackResult.ok && slackResult.channelId) {
          // Record the notification thread info on the session so replies can be routed back
          await setSessionHumanTakeoverNotification(supabase, {
            sessionId,
            slackChannelId: slackResult.channelId,
            slackThreadTs: slackResult.messageTs,
            userId,
          })

          // Record the Slack notification
          await recordNotification({
            userId,
            type: 'human_needed',
            channel: 'slack',
            metadata: {
              sessionId,
              projectId,
              sessionName,
              slackChannelId: slackResult.channelId,
            },
            dedupKey: `${dedupKey}:slack`,
          })

          console.log(`${LOG_PREFIX} Sent Slack DM notification for session ${sessionId}`)
        } else {
          console.warn(`${LOG_PREFIX} Failed to send Slack DM:`, slackResult.error)
        }
      } catch (slackError) {
        console.error(`${LOG_PREFIX} Failed to send Slack notification:`, slackError)
      }
    } else {
      console.log(`${LOG_PREFIX} Slack notification disabled by user preferences`)
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error sending human needed notification:`, error)
    // Don't throw - this is a best-effort notification
  }
}
