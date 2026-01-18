'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { WaterWebGLProvider, WaterCanvas } from '@/components/water-webgl'
import { ThemeLogo } from '@/components/ui'
import { WaitlistProvider } from './waitlist-context'
import { WaitlistDialog } from './waitlist-dialog'
import { MarketingNav } from './marketing-nav'

export function MarketingLayoutClient({ children }: { children: ReactNode }) {
  return (
    <WaterWebGLProvider>
      <WaitlistProvider>
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
                  <ThemeLogo width={56} height={16} />
                  <span className="text-xs text-[var(--text-secondary)]">
                    &copy; {new Date().getFullYear()} Hissuno
                  </span>
                </div>
                <div className="flex items-center gap-4">
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

        {/* Waitlist Dialog */}
        <WaitlistDialog />
      </WaitlistProvider>
    </WaterWebGLProvider>
  )
}
