import posthog from 'posthog-js'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: (
      command: 'track' | 'trackCustom' | 'init',
      eventName: string,
      parameters?: Record<string, unknown>
    ) => void
    _fbq?: typeof Window.prototype.fbq
  }
}

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
    person_profiles: 'identified_only', // No person profiles until identify()
    capture_pageview: true,
    capture_pageleave: true,
    persistence: consent === 'accepted' ? 'localStorage+cookie' : 'memory',
    disable_session_recording: consent !== 'accepted',
  })
}

// Initialize Google Ads only with consent
if (consent === 'accepted') {
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  if (googleAdsId) {
    // Load gtag script
    const script = document.createElement('script')
    script.src = `https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`
    script.async = true
    document.head.appendChild(script)

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || []
    const gtag = (...args: unknown[]) => {
      window.dataLayer.push(args)
    }
    window.gtag = gtag
    gtag('js', new Date())
    gtag('config', googleAdsId)
  }
}

// Initialize Meta Pixel only with consent
if (consent === 'accepted') {
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

    // Track initial PageView
    window.fbq?.('track', 'PageView')
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
