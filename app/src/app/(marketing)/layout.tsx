import type { Metadata } from 'next'
import Link from 'next/link'
import { WaterWebGLProvider, WaterCanvas } from '@/components/water-webgl'
import { MarketingNav } from '@/components/landing/marketing-nav'
import { CookieConsentBanner } from '@/components/consent'


export const metadata: Metadata = {
  title: 'Hissuno — Your Agents Don\'t Know Your Product. Hissuno Fixes That.',
  description:
    'Connect your customer signals, product goals, issues, docs, and codebase into one knowledge graph. Any AI agent can traverse it to build real understanding of your product.',
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <WaterWebGLProvider enableClickRipples>
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
                  Support Agent
                </Link>
                <Link
                  href="/landing/pm-copilot"
                  className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                >
                  PM Co-Pilot
                </Link>
                <Link
                  href="/faq"
                  className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                >
                  FAQ
                </Link>
                <Link
                  href="/docs"
                  className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                >
                  Docs
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <CookieConsentBanner />
    </WaterWebGLProvider>
  )
}
