import { Resend } from 'resend'

let resendClient: Resend | null = null

export function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not configured')
    }
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export function getFromAddress(): string {
  return process.env.EMAIL_FROM_ADDRESS ?? 'Hissuno <hello@hissuno.com>'
}
