import type { Metadata } from 'next'
import Link from 'next/link'
import { WaterWebGLProvider, WaterCanvas } from '@/components/water-webgl'
import { CTAProvider } from '@/components/landing/cta-context'
import { CTAOptionsDialog } from '@/components/landing/cta-options-dialog'
import { WaitlistDialog } from '@/components/landing/waitlist-dialog'
import { ThankYouModal } from '@/components/landing/thank-you-modal'
import { MarketingNav } from '@/components/landing/marketing-nav'
import { CookieConsentBanner } from '@/components/consent'


export const metadata: Metadata = {
  title: 'Hissuno - Turn Customer Conversations into Engineering Work',
  description:
    'AI-powered customer intelligence platform that converts conversations into actionable issues, product specs, and code changes.',
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <WaterWebGLProvider>
      <CTAProvider>
        <div className="min-h-screen" suppressHydrationWarning>
          <WaterCanvas />

          {/* Navigation */}
          <MarketingNav />

          {/* Main content with header offset */}
          <main className="relative pt-16">{children}</main>

          {/* Footer */}
          <footer className="relative border-t border-[var(--border-subtle)]/50 bg-[var(--surface)]/80 backdrop-blur-sm">
            <div className="mx-auto max-w-6xl px-6 py-4 md:px-12">
              <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[var(--text-secondary)]">
                    &copy; {new Date().getFullYear()} Hissuno
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    href="/roadmap"
                    className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                  >
                    Roadmap
                  </Link>
                  <Link
                    href="/legal/terms"
                    className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                  >
                    Terms
                  </Link>
                  <Link
                    href="/legal/privacy"
                    className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                  >
                    Privacy
                  </Link>
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* Dialogs */}
        <CTAOptionsDialog />
        <WaitlistDialog />
        <ThankYouModal />
        <CookieConsentBanner />
      </CTAProvider>
    </WaterWebGLProvider>
  )
}
