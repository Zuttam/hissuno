import posthog from 'posthog-js'

const CONSENT_KEY = 'hissuno_cookie_consent'

// Check consent from localStorage (available at this point)
const consent =
  typeof window !== 'undefined' ? localStorage.getItem(CONSENT_KEY) : null

// Always initialize PostHog for anonymous pageview tracking
// Consent controls persistence and session recording
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    // person_profiles: 'identified_only', // No person profiles until identify()
    capture_pageview: true,
    capture_pageleave: true,
    persistence: consent === 'accepted' ? 'localStorage+cookie' : 'memory',
    disable_session_recording: consent !== 'accepted',
  })
}

// Initialize Google Ads with Consent Mode v2
const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
if (googleAdsId) {
  // Initialize dataLayer and gtag BEFORE loading script
  // Must use 'arguments' pattern for gtag.js compatibility
  window.dataLayer = window.dataLayer || []
  function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  }
  window.gtag = gtag

  // Set default consent state BEFORE loading gtag script
  gtag('consent', 'default', {
    ad_storage: consent === 'accepted' ? 'granted' : 'denied',
    ad_user_data: consent === 'accepted' ? 'granted' : 'denied',
    ad_personalization: consent === 'accepted' ? 'granted' : 'denied',
    analytics_storage: consent === 'accepted' ? 'granted' : 'denied',
  })

  gtag('js', new Date())
  gtag('config', googleAdsId)

  // Load gtag script AFTER setting up dataLayer
  const script = document.createElement('script')
  script.src = `https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`
  script.async = true
  document.head.appendChild(script)
}

// Initialize Meta Pixel with consent mode
const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
if (metaPixelId) {
  // Initialize fbq function and queue
  ;(function (f: Window, b: Document, e: string, v: string, t?: HTMLScriptElement, s?: Element | null) {
    if (f.fbq) return
    const n: any = (f.fbq = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args)
    })
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    t = b.createElement(e) as HTMLScriptElement
    t.async = true
    t.src = v
    s = b.getElementsByTagName(e)[0]
    s?.parentNode?.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')

  // Initialize pixel
  window.fbq?.('init', metaPixelId)

  // Set consent state
  if (consent === 'accepted') {
    window.fbq?.('consent', 'grant')
    window.fbq?.('track', 'PageView')
  } else {
    window.fbq?.('consent', 'revoke')
  }
}

// Track route changes (Next.js 15.3+ instrumentation hook)
export function onRouterTransitionStart(
  url: string,
  navigationType: 'push' | 'replace' | 'traverse'
): void {
  // PostHog auto-captures with capture_pageview: true

  // Only track with consent
  if (consent === 'accepted') {
    // Google Ads page_view
    if (window.gtag) {
      window.gtag('event', 'page_view', { page_path: url, navigation_type: navigationType })
    }

    // Meta Pixel PageView
    if (window.fbq) {
      window.fbq('track', 'PageView')
    }
  }
}
