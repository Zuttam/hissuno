'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui'
import { signOutAction } from '@/lib/auth/actions'
import type { SessionUser } from '@/lib/auth/server'
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference'

interface SidebarAccountSectionProps {
  user: SessionUser | null
  isCollapsed: boolean
  onNavigate?: () => void
}

function SignOutButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant="danger"
      size="sm"
      loading={pending}
      disabled={pending}
      className="w-full justify-start"
    >
      {pending ? 'Signing out...' : 'Sign out'}
    </Button>
  )
}

// Icons for account section
function AccountIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function NotificationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75v-.7V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  )
}

function DocsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  )
}

const ACCOUNT_LINKS = [
  { href: '/account/settings', label: 'Account', icon: AccountIcon },
  { href: '/account/notifications', label: 'Notifications', icon: NotificationIcon },
  { href: '/docs', label: 'Docs', icon: DocsIcon, external: true },
] as const

export function SidebarAccountSection({ user, isCollapsed, onNavigate }: SidebarAccountSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()
  const { theme, setThemePreference } = useThemePreference()

  const isAccountActive = ACCOUNT_LINKS.some((link) => !('external' in link) && pathname.startsWith(link.href))

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('pointerdown', handlePointerDown)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ]

  const label = user?.name ?? user?.email ?? 'Account'

  const handleLinkClick = () => {
    setMenuOpen(false)
    onNavigate?.()
  }

  if (isCollapsed) {
    return (
      <div className="relative flex flex-col items-center space-y-0.5" ref={containerRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className={`flex h-8 w-8 items-center justify-center rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] ${
            isAccountActive ? 'border-[color:var(--foreground)]' : ''
          }`}
          title={label}
        >
          <span className="font-mono text-xs font-bold uppercase">
            {label.slice(0, 2).toUpperCase()}
          </span>
        </button>

        {menuOpen && (
          <div className="absolute bottom-0 left-full z-50 ml-2 w-56 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3 shadow-lg">
            <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 text-sm">
              <p className="truncate font-mono font-bold uppercase text-[color:var(--foreground)]">{label}</p>
              <p className="font-mono text-xs text-[color:var(--text-secondary)]">Signed in</p>
            </div>
            <div className="mt-3 space-y-1">
              {ACCOUNT_LINKS.map((link) => {
                const Icon = link.icon
                const active = !('external' in link) && pathname.startsWith(link.href)
                const className = `flex items-center gap-2 rounded-[4px] px-2 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide transition ${
                  active
                    ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]'
                }`
                return 'external' in link ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleLinkClick}
                    className={className}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{link.label}</span>
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={handleLinkClick}
                    className={className}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>
            <div className="mt-3 border-t border-[color:var(--border-subtle)] pt-3 space-y-2">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">
                  Theme
                </p>
                <div className="mt-1 grid gap-1">
                  {themeOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="ghost"
                      size="sm"
                      selected={option.value === theme}
                      onClick={() => setThemePreference(option.value)}
                      className="justify-start"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <form action={signOutAction}>
                <SignOutButton />
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-2" ref={containerRef}>
      {/* User info and dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 transition hover:bg-[color:var(--surface-hover)] ${
            isAccountActive ? 'bg-[color:var(--surface-hover)]' : ''
          }`}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--foreground)]">
            <span className="font-mono text-xs font-bold uppercase">
              {label.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="truncate font-mono text-xs font-semibold text-[color:var(--foreground)]">
              {label}
            </p>
          </div>
          <svg
            className={`h-3.5 w-3.5 flex-shrink-0 text-[color:var(--text-tertiary)] transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3 shadow-lg">
            {/* Account links */}
            <div className="space-y-1">
              {ACCOUNT_LINKS.map((link) => {
                const Icon = link.icon
                const active = !('external' in link) && pathname.startsWith(link.href)
                const className = `flex items-center gap-2 rounded-[4px] px-2 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide transition ${
                  active
                    ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]'
                }`
                return 'external' in link ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleLinkClick}
                    className={className}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{link.label}</span>
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={handleLinkClick}
                    className={className}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Theme */}
            <div className="mt-3 border-t border-[color:var(--border-subtle)] pt-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">
                Theme
              </p>
              <div className="mt-1 grid gap-1">
                {themeOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    selected={option.value === theme}
                    onClick={() => setThemePreference(option.value)}
                    className="justify-start"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sign out */}
            <div className="mt-3 border-t border-[color:var(--border-subtle)] pt-3">
              <form action={signOutAction}>
                <SignOutButton />
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
