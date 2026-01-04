import posthog from 'posthog-js'
import type { SignupEventData, OnboardingCompletedEventData } from './types'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * Track when a user starts the signup process
 */
export function trackSignupStarted(data: SignupEventData): void {
  const properties = {
    method: data.method,
    ...data.utm,
  }

  // PostHog
  posthog.capture('signup_started', properties)

  // Google Ads (YouTube)
  window.gtag?.('event', 'begin_checkout')
}

/**
 * Track when a user completes signup (account created)
 */
export function trackSignupCompleted(userId: string, data: SignupEventData): void {
  const properties = {
    method: data.method,
    ...data.utm,
  }

  // PostHog - identify and track
  if (userId) {
    posthog.identify(userId, { signup_method: data.method })
  }
  posthog.capture('signup_completed', properties)

  // Google Ads - conversion (YouTube)
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  if (googleAdsId) {
    window.gtag?.('event', 'conversion', {
      send_to: `${googleAdsId}/signup`,
      value: 1.0,
      currency: 'USD',
    })
  }

  window.gtag?.('event', 'sign_up', { method: data.method })
}

/**
 * Track when a user completes the onboarding flow
 */
export function trackOnboardingCompleted(data: OnboardingCompletedEventData): void {
  const properties = {
    selected_use_cases: data.selectedUseCases,
    use_case_count: data.selectedUseCases.length,
    ...data.utm,
  }

  // PostHog
  posthog.capture('onboarding_completed', properties)

  // Google Ads - conversion (YouTube)
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  if (googleAdsId) {
    window.gtag?.('event', 'conversion', {
      send_to: `${googleAdsId}/onboarding`,
      value: 5.0,
      currency: 'USD',
    })
  }

  window.gtag?.('event', 'tutorial_complete')
}

/**
 * Track page views (useful for SPA navigation)
 */
export function trackPageView(path: string): void {
  posthog.capture('$pageview', { $current_url: path })
  window.gtag?.('event', 'page_view', { page_path: path })
}
