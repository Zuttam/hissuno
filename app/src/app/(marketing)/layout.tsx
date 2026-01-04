import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { WaterWebGLProvider, WaterCanvas } from '@/components/water-webgl'

export const metadata: Metadata = {
  title: 'Hissuno - Turn Customer Conversations into Engineering Work',
  description:
    'AI-powered customer intelligence platform that converts conversations into actionable issues, product specs, and code changes.',
}

const SLACK_INVITE_URL = 'https://join.slack.com/t/hissuno/shared_invite/zt-3miqrr3f6-~E6eKM4Mgk1oZwUGMy6mTg'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <WaterWebGLProvider>
      <div className="min-h-screen" suppressHydrationWarning>
        <WaterCanvas />

        {/* Navigation */}
        <header className="fixed left-0 right-0 top-0 z-50 mx-auto border-b border-[var(--border-subtle)]/30 bg-[var(--background)]/60 px-6 backdrop-blur-xl md:px-12">
          <nav className="mx-auto flex max-w-6xl items-center justify-between py-4">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Hissuno" width={120} height={40} priority />
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="font-mono text-sm font-semibold uppercase tracking-wide text-[var(--foreground)] transition hover:text-[var(--accent-teal)]"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="rounded-[4px] bg-[var(--accent-selected)] px-4 py-2 font-mono text-sm font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </header>

        {/* Main content with header offset */}
        <main className="relative pt-16">{children}</main>

        {/* Footer */}
        <footer className="relative border-t border-[var(--border-subtle)]/50 bg-[var(--surface)]/80 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-6 py-12 md:px-12">
            <div className="flex flex-col gap-8">
              {/* Top row: Logo and community */}
              <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                <div className="flex items-center gap-6">
                  <Image src="/logo.png" alt="Hissuno" width={100} height={32} />
                  <a
                    href={SLACK_INVITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                  >
                    <Image src="/slack.svg" alt="" width={18} height={18} />
                    Join our Slack community
                  </a>
                </div>
              </div>

              {/* Bottom row: Copyright and legal links */}
              <div className="flex flex-col items-center justify-between gap-4 border-t border-[var(--border-subtle)]/30 pt-6 md:flex-row">
                <p className="text-sm text-[var(--text-secondary)]">
                  &copy; {new Date().getFullYear()} Hissuno. All rights reserved.
                </p>
                <div className="flex items-center gap-6">
                  <Link
                    href="/terms"
                    className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                  >
                    Terms of Service
                  </Link>
                  <Link
                    href="/privacy"
                    className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--accent-teal)]"
                  >
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </WaterWebGLProvider>
  )
}
