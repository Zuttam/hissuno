/**
 * Global type declarations for third-party tracking scripts
 */

declare global {
  interface Window {
    // Google Tag Manager / gtag
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void

    // Meta Pixel
    fbq?: (command: string, ...args: unknown[]) => void
    _fbq?: typeof Window.prototype.fbq
  }
}

export {}
