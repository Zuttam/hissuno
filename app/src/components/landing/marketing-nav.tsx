'use client'

import Link from 'next/link'
import { ThemeLogo, Button, ThemeToggle } from '@/components/ui'
import { useWaitlist } from './waitlist-context'
import { useRouter } from 'next/navigation'

export function MarketingNav() {
  const { openWaitlistDialog } = useWaitlist()
  const router = useRouter()

  const handleSignInClick = () => {
    router.push('/login')
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 mx-auto px-4 py-0.5 transition-all duration-300 bg-[var(--background)]/40 backdrop-blur-xl backdrop-saturate-150 border-b border-[var(--border-subtle)]/50 shadow-[0_1px_4px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.25)]">
      {/* Inner glow/highlight line for glass edge effect */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)]/40 to-transparent" />

      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <ThemeLogo width={56} height={16} priority />
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button
            size="sm"
            variant='secondary'
            onClick={handleSignInClick}
            className="py-2"
          >
            Sign In
          </Button>
          <Button
            size="sm"
            onClick={openWaitlistDialog}
            className="bg-[var(--accent-selected)] hover:opacity-90 py-2"
          >
            Get Started
          </Button>
        </div>
      </nav>
    </header>
  )
}
