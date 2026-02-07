import posthog from 'posthog-js'
import type {
  SignupEventData,
  OnboardingCompletedEventData,
  CTAEventData,
  CallBookingEventData,
} from './types'

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

  // Meta Pixel - InitiateCheckout event
  window.fbq?.('track', 'InitiateCheckout', {
    content_name: 'Signup',
    content_category: 'Registration',
  })
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
  const signupLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_SIGNUP
  if (googleAdsId && signupLabel) {
    window.gtag?.('event', 'conversion', {
      send_to: `${googleAdsId}/${signupLabel}`,
      value: 1.0,
      currency: 'USD',
    })
  }

  window.gtag?.('event', 'sign_up', { method: data.method })

  // Meta Pixel - Lead event
  window.fbq?.('track', 'Lead', {
    content_name: 'Account Creation',
    content_category: 'Signup',
    value: 1.0,
    currency: 'USD',
  })
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
  const onboardingLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_ONBOARDING
  if (googleAdsId && onboardingLabel) {
    window.gtag?.('event', 'conversion', {
      send_to: `${googleAdsId}/${onboardingLabel}`,
      value: 5.0,
      currency: 'USD',
    })
  }

  window.gtag?.('event', 'tutorial_complete')

  // Meta Pixel - CompleteRegistration event
  window.fbq?.('track', 'CompleteRegistration', {
    content_name: 'Onboarding',
    content_category: 'Setup',
    value: 5.0,
    currency: 'USD',
  })
}

/**
 * Track page views (useful for SPA navigation)
 */
export function trackPageView(path: string): void {
  posthog.capture('$pageview', { $current_url: path })
  window.gtag?.('event', 'page_view', { page_path: path })
}

/**
 * Track when CTA options modal is viewed
 */
export function trackCTAOptionsViewed(data: CTAEventData): void {
  const properties = {
    source: data.source,
    ...data.utm,
  }

  // PostHog
  posthog.capture('cta_options_viewed', properties)

  // Google Ads
  window.gtag?.('event', 'view_item_list', { item_list_name: 'cta_options' })

  // Meta Pixel - ViewContent event
  window.fbq?.('track', 'ViewContent', {
    content_name: 'CTA Options',
    content_type: 'modal',
  })
}

/**
 * Track when user selects a CTA option
 */
export function trackCTAOptionSelected(data: CTAEventData): void {
  const properties = {
    source: data.source,
    option: data.option,
    ...data.utm,
  }

  // PostHog
  posthog.capture('cta_option_selected', properties)

  // Google Ads
  window.gtag?.('event', 'select_item', { item_list_name: 'cta_options', items: [{ item_name: data.option }] })

  // Meta Pixel - custom event (no standard equivalent)
  window.fbq?.('trackCustom', 'CTAOptionSelected', {
    content_name: data.option,
    source: data.source,
  })
}

/**
 * Track when waitlist signup is completed
 */
export function trackWaitlistCompleted(data: { email?: string; utm?: Record<string, string> }): void {
  const properties = {
    ...data.utm,
  }

  // PostHog
  posthog.capture('waitlist_completed', properties)

  // Google Ads - conversion (fire BEFORE navigation to ensure it's sent)
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  const thankYouLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_THANK_YOU || 'p6Z7CJ_ivewbEMjU0dRC'
  if (googleAdsId && thankYouLabel) {
    console.debug('Firing Google Ads waitlist conversion event')
    
    window.gtag?.('event', 'conversion', {
      send_to: `${googleAdsId}/${thankYouLabel}`,
      value: 5.0,
      currency: 'USD',
    })
  }

  // Meta Pixel - Lead event
  window.fbq?.('track', 'Lead', {
    content_name: 'Waitlist Signup',
    content_category: 'Conversion',
    value: 5.0,
    currency: 'USD',
  })
}

/**
 * Track when a user requests access to a gated feature
 */
export function trackFeatureAccessRequested(data: { feature: string }): void {
  posthog.capture('feature_access_requested', { feature: data.feature })
}

/**
 * Track when Calendly popup is opened
 */
export function trackCallBookingStarted(data: CallBookingEventData): void {
  const properties = {
    ...data.utm,
  }

  // PostHog
  posthog.capture('call_booking_started', properties)

  // Google Ads
  window.gtag?.('event', 'begin_checkout')

  // Meta Pixel - InitiateCheckout event
  window.fbq?.('track', 'InitiateCheckout', {
    content_name: 'Call Booking',
    content_category: 'Demo',
  })
}

/**
 * Track when a call booking is completed
 */
export function trackCallBookingCompleted(data: CallBookingEventData): void {
  const properties = {
    event_uri: data.eventUri,
    invitee_uri: data.inviteeUri,
    ...data.utm,
  }

  // PostHog
  posthog.capture('call_booking_completed', properties)

  // Google Ads - conversion (fire BEFORE navigation to ensure it's sent)
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  const thankYouLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_THANK_YOU || 'p6Z7CJ_ivewbEMjU0dRC'
  if (googleAdsId && thankYouLabel) {
    window.gtag?.('event', 'conversion', {
      send_to: `${googleAdsId}/${thankYouLabel}`,
      value: 10.0,
      currency: 'USD',
    })
  }

  // Meta Pixel - Lead event
  window.fbq?.('track', 'Lead', {
    content_name: 'Call Booked',
    content_category: 'Conversion',
    value: 10.0,
    currency: 'USD',
  })
}

