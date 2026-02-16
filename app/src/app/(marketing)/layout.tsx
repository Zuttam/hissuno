import type { Metadata } from 'next'
import Link from 'next/link'
import { WaterWebGLProvider, WaterCanvas } from '@/components/water-webgl'
import { CTAProvider } from '@/components/landing/cta-context'
import { WaitlistDialog } from '@/components/landing/waitlist-dialog'
import { ThankYouModal } from '@/components/landing/thank-you-modal'
import { MarketingNav } from '@/components/landing/marketing-nav'
import { CookieConsentBanner } from '@/components/consent'


export const metadata: Metadata = {
  title: 'Hissuno - Customer Feedback to Product Specs, Automatically',
  description:
    'AI that triages customer conversations, creates prioritized issues, and writes product specs linked to your codebase.',
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <WaterWebGLProvider enableClickRipples>
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
                    href="/landing/support-agent"
                    className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                  >
                    AI Support
                  </Link>
                  <Link
                    href="/landing/pm-copilot"
                    className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                  >
                    PM Co-Pilot
                  </Link>
                  <Link
                    href="/landing/fde"
                    className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                  >
                    AI Engineer
                  </Link>
                  <Link
                    href="/landing/roadmap"
                    className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                  >
                    Roadmap
                  </Link>
                  <Link
                    href="/docs"
                    className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                  >
                    Docs
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
        <WaitlistDialog />
        <ThankYouModal />
        <CookieConsentBanner />
      </CTAProvider>
    </WaterWebGLProvider>
  )
}
