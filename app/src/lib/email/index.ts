import { render } from '@react-email/components'
import { getResendClient, getFromAddress, isResendConfigured } from './resend'
import { WelcomeEmail } from './templates/welcome'
import { createAdminClient } from '@/lib/supabase/server'
import type { SendEmailResult, WelcomeEmailData } from './types'

export { isResendConfigured }
export type { SendEmailResult, WelcomeEmailData }

/**
 * Send a welcome email to a new user.
 * This function is idempotent - it won't send if already sent.
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    console.warn('[email.sendWelcomeEmail] Resend not configured, skipping email')
    return { success: false, error: 'Email service not configured' }
  }

  const { userId, email, fullName } = data
  const supabase = createAdminClient()

  // Check if welcome email was already sent
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('welcome_email_sent_at')
    .eq('user_id', userId)
    .single()

  if (profile?.welcome_email_sent_at) {
    console.log('[email.sendWelcomeEmail] Welcome email already sent to', email)
    return { success: true, error: 'Already sent' }
  }

  try {
    const resend = getResendClient()
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.hissuno.com'}/projects`

    // Pre-render to HTML to avoid Resend's internal rendering issues with Next.js bundling
    const emailHtml = await render(WelcomeEmail({ fullName, dashboardUrl }))

    const { data: result, error } = await resend.emails.send({
      from: getFromAddress(),
      to: email,
      subject: 'Welcome to Hissuno!',
      html: emailHtml,
    })

    if (error) {
      console.error('[email.sendWelcomeEmail] Failed to send:', error)
      return { success: false, error: error.message }
    }

    // Mark welcome email as sent (upsert to handle case where profile doesn't exist yet)
    const { error: updateError } = await supabase.from('user_profiles').upsert(
      {
        user_id: userId,
        welcome_email_sent_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (updateError) {
      console.warn('[email.sendWelcomeEmail] Failed to update profile:', updateError)
      // Don't fail - email was sent successfully
    }

    console.log('[email.sendWelcomeEmail] Sent welcome email to', email, result?.id)
    return { success: true, messageId: result?.id }
  } catch (error) {
    console.error('[email.sendWelcomeEmail] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if welcome email should be sent and send it.
 * Used after successful authentication to handle OAuth users.
 */
export async function sendWelcomeEmailIfNeeded(
  userId: string,
  email: string,
  fullName?: string | null
): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    console.warn('[email.sendWelcomeEmailIfNeeded] Resend not configured, skipping')
    return { success: false, error: 'Email service not configured' }
  }

  const supabase = createAdminClient()

  // Check if welcome email was already sent
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('welcome_email_sent_at')
    .eq('user_id', userId)
    .single()

  if (profile?.welcome_email_sent_at) {
    return { success: true, error: 'Already sent' }
  }

  return sendWelcomeEmail({ userId, email, fullName })
}
