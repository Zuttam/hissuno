import { lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js'

let isConfigured = false

/**
 * Configure the Lemon Squeezy SDK with API credentials
 * Must be called before using any Lemon Squeezy APIs
 */
export function configureLemonSqueezy() {
  if (isConfigured) return

  const apiKey = process.env.LEMONSQUEEZY_API_KEY

  if (!apiKey) {
    console.warn('[lemon-squeezy] LEMONSQUEEZY_API_KEY is not set')
    return
  }

  lemonSqueezySetup({ apiKey })
  isConfigured = true
}

/**
 * Check if Lemon Squeezy is configured with valid credentials
 */
export function isLemonSqueezyConfigured(): boolean {
  return Boolean(process.env.LEMONSQUEEZY_API_KEY)
}

/**
 * Get the Lemon Squeezy store ID from environment
 */
export function getStoreId(): string | undefined {
  return process.env.LEMONSQUEEZY_STORE_ID
}

/**
 * Get the webhook secret for verifying webhook signatures
 */
export function getWebhookSecret(): string | undefined {
  return process.env.LEMONSQUEEZY_WEBHOOK_SECRET
}
