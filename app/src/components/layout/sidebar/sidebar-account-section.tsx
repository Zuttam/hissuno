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
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function BillingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
    </svg>
  )
}

function GiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  )
}

export function SidebarAccountSection({ user, isCollapsed, onNavigate }: SidebarAccountSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()
  const { theme, setThemePreference } = useThemePreference()

  const isSettingsActive = pathname.startsWith('/account/settings')
  const isInvitesActive = pathname.startsWith('/account/promotions')
  const isBillingActive = pathname.startsWith('/account/billing')

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

  if (isCollapsed) {
    return (
      <div className="relative flex flex-col items-center space-y-0.5" ref={containerRef}>
        <Link
          href="/account/settings"
          onClick={onNavigate}
          className={`flex h-8 w-8 items-center justify-center rounded-[4px] transition ${
            isSettingsActive
              ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
              : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]'
          }`}
          title="Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </Link>
        <Link
          href="/account/promotions"
          onClick={onNavigate}
          className={`flex h-8 w-8 items-center justify-center rounded-[4px] transition ${
            isInvitesActive
              ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
              : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]'
          }`}
          title="Referral"
        >
          <GiftIcon className="h-4 w-4" />
        </Link>
        <Link
          href="/account/billing"
          onClick={onNavigate}
          className={`flex h-8 w-8 items-center justify-center rounded-[4px] transition ${
            isBillingActive
              ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
              : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]'
          }`}
          title="Billing"
        >
          <BillingIcon className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-8 w-8 items-center justify-center rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
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
            <div className="mt-3 space-y-2">
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
    <div className="space-y-0.5 px-2" ref={containerRef}>
      <Link
        href="/account/settings"
        onClick={onNavigate}
        className={`flex items-center gap-2 rounded-[4px] px-2 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide transition ${
          isSettingsActive
            ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
            : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]'
        }`}
      >
        <SettingsIcon className="h-4 w-4 flex-shrink-0" />
        <span>Settings</span>
      </Link>
      <Link
        href="/account/promotions"
        onClick={onNavigate}
        className={`flex items-center gap-2 rounded-[4px] px-2 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide transition ${
          isInvitesActive
            ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
            : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]'
        }`}
      >
        <GiftIcon className="h-4 w-4 flex-shrink-0" />
        <span>Referral</span>
      </Link>
      <Link
        href="/account/billing"
        onClick={onNavigate}
        className={`flex items-center gap-2 rounded-[4px] px-2 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide transition ${
          isBillingActive
            ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
            : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]'
        }`}
      >
        <BillingIcon className="h-4 w-4 flex-shrink-0" />
        <span>Billing</span>
      </Link>

      {/* User info and sign out */}
      <div className="relative mt-2 pt-2 border-t border-[color:var(--border-subtle)]">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 transition hover:bg-[color:var(--surface-hover)]"
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
            <div className="mt-3">
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
