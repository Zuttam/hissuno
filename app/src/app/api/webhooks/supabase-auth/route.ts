import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendWelcomeEmail } from '@/lib/email'

export const runtime = 'nodejs'

interface SupabaseAuthWebhookPayload {
  type: 'user.signed_up' | 'user.updated' | 'user.deleted'
  table: string
  record: {
    id: string
    email?: string
    email_confirmed_at?: string | null
    raw_user_meta_data?: {
      full_name?: string
      name?: string
      avatar_url?: string
    }
    raw_app_meta_data?: {
      provider?: string
      providers?: string[]
    }
  }
  old_record?: {
    email_confirmed_at?: string | null
  }
}

function getWebhookSecret(): string | undefined {
  return process.env.SUPABASE_AUTH_WEBHOOK_SECRET
}

function verifySignature(payload: string, signature: string | null): boolean {
  const secret = getWebhookSecret()
  if (!secret || !signature) return false

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const expectedSignature = hmac.digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-supabase-signature')

    // Verify webhook signature
    if (!verifySignature(rawBody, signature)) {
      console.error('[webhook.supabase-auth] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
    }

    const payload: SupabaseAuthWebhookPayload = JSON.parse(rawBody)
    console.log(`[webhook.supabase-auth] Received event: ${payload.type}`)

    // Handle email confirmation (for email/password signups)
    if (payload.type === 'user.updated') {
      const wasUnconfirmed = !payload.old_record?.email_confirmed_at
      const isNowConfirmed = Boolean(payload.record.email_confirmed_at)
      const isEmailProvider = payload.record.raw_app_meta_data?.provider === 'email'

      if (wasUnconfirmed && isNowConfirmed && isEmailProvider) {
        const userId = payload.record.id
        const email = payload.record.email
        const fullName =
          payload.record.raw_user_meta_data?.full_name ?? payload.record.raw_user_meta_data?.name

        if (email) {
          console.log('[webhook.supabase-auth] Email confirmed, sending welcome email to', email)

          // Send asynchronously - don't block webhook response
          setImmediate(() => {
            sendWelcomeEmail({ userId, email, fullName }).catch((error) => {
              console.error('[webhook.supabase-auth] Failed to send welcome email:', error)
            })
          })
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[webhook.supabase-auth] Error processing webhook', error)
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}
