import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Strict email regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export async function POST(request: Request) {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: 'Service not configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { email, website } = body as { email?: string; website?: string }

    // Honeypot check - if website field is filled, it's likely a bot
    if (website) {
      // Return success to not give bots feedback, but don't save
      return NextResponse.json({ success: true })
    }

    // Validate email exists
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    // Sanitize email
    const sanitizedEmail = email.trim().toLowerCase()

    // Validate email length (RFC 5321 limit)
    if (sanitizedEmail.length > 254) {
      return NextResponse.json({ error: 'Email is too long.' }, { status: 400 })
    }

    // Validate email format
    if (!EMAIL_REGEX.test(sanitizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 })
    }

    // Get IP address for rate limiting
    const headersList = await headers()
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || null

    const supabase = createAdminClient()

    // Insert into waitlist, ignore duplicates
    const { error } = await supabase.from('waitlist').insert({
      email: sanitizedEmail,
      ip_address: ipAddress,
    })

    // Handle duplicate email gracefully
    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation - email already exists
        return NextResponse.json({ success: true })
      }
      console.error('[api/waitlist.POST] insert error', error)
      return NextResponse.json({ error: 'Failed to join waitlist.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[api/waitlist.POST] unexpected error', error)
    return NextResponse.json({ error: 'Failed to join waitlist.' }, { status: 500 })
  }
}
