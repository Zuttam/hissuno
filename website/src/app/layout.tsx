import type { Metadata } from 'next'
import Link from 'next/link'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { WaterWebGLProvider, WaterCanvas } from '@/components/water-webgl'
import { MarketingNav } from '@/components/landing/marketing-nav'
import { CookieConsentBanner } from '@/components/consent'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Hissuno - Your Agents Don\'t Know Your Product. Hissuno Fixes That.',
  description:
    'Organizational knowledge graph for AI agents. Connect customer signals, product goals, issues, docs, and codebase - any agent can query and traverse it via MCP, CLI, or API.',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Hissuno',
  applicationCategory: 'DeveloperApplication',
  description:
    'Organizational knowledge graph for AI agents. Connects customer signals, product goals, issues, docs, and codebase into one traversable graph queryable via MCP, CLI, or API.',
  url: 'https://hissuno.com',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <WaterWebGLProvider enableClickRipples>
            <div className="min-h-screen" suppressHydrationWarning>
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
              />
              <WaterCanvas />

              <MarketingNav />

              <main className="relative pt-16">{children}</main>

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
        </ThemeProvider>
      </body>
    </html>
  )
}
