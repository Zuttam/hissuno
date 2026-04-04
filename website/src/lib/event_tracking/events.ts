import posthog from 'posthog-js'
import type {
  InstallCommandCopiedEventData,
  GitHubRepoClickedEventData,
  CallBookingEventData,
} from './types'

/**
 * Track when a user copies an install command
 */
export function trackInstallCommandCopied(data: InstallCommandCopiedEventData): void {
  const properties = {
    command_type: data.command_type,
    source: data.source,
    ...data.utm,
  }

  // PostHog
  posthog.capture('install_command_copied', properties)

  // Google Ads - conversion
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  const installLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_INSTALL
  if (googleAdsId && installLabel) {
    window.gtag?.('event', 'conversion', {
      send_to: `${googleAdsId}/${installLabel}`,
      value: 1.0,
      currency: 'USD',
    })
  }

  // Meta Pixel - Lead event
  window.fbq?.('track', 'Lead', {
    content_name: 'Install Command',
    content_category: 'Install',
    value: 1.0,
    currency: 'USD',
  })
}

/**
 * Track when a user clicks the GitHub repo link
 */
export function trackGitHubRepoClicked(data: GitHubRepoClickedEventData): void {
  const properties = {
    source: data.source,
    ...data.utm,
  }

  // PostHog
  posthog.capture('github_repo_clicked', properties)

  // Google Ads
  window.gtag?.('event', 'select_content', { content_type: 'github_repo' })

  // Meta Pixel - ViewContent event
  window.fbq?.('track', 'ViewContent', {
    content_name: 'GitHub Repository',
    content_type: 'repository',
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
