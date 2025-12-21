'use client'

import Link from 'next/link'
import { Button } from '@/components/ui'
import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { signOutAction } from '@/lib/auth/actions'
import type { SessionUser } from '@/lib/auth/server'
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference'

interface UserAccountMenuProps {
  user: SessionUser | null
}

function SignOutButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant="danger"
      size="md"
      loading={pending}
      disabled={pending}
      className="w-full justify-start"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}

export function UserAccountMenu({ user }: UserAccountMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { theme, setThemePreference } = useThemePreference()

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('pointerdown', handlePointerDown)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const label = user?.email ?? 'Account'
  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ]

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] px-4 py-2 text-sm font-mono font-semibold uppercase tracking-wide text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-primary)]"
      >
        {label.slice(0, 2).toUpperCase()}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-3 w-64 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3">
          <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 text-sm">
            <p className="font-mono font-bold uppercase text-[color:var(--foreground)]">{label}</p>
            <p className="font-mono text-xs text-[color:var(--text-secondary)]">Signed in</p>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
                Theme
              </p>
              <div className="mt-2 grid gap-2">
                {themeOptions.map((option) => {
                  const isActive = option.value === theme
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant="ghost"
                      size="md"
                      selected={isActive}
                      onClick={() => setThemePreference(option.value)}
                      className="flex items-center justify-between"
                    >
                      <span>{option.label}</span>
                      {isActive ? <span className="text-xs">Active</span> : null}
                    </Button>
                  )
                })}
              </div>
            </div>
            <Link
              href="/account/settings"
              onClick={() => setOpen(false)}
              className="block rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-3 py-2 font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
            >
              Account settings
            </Link>
            <form action={signOutAction}>
              <SignOutButton />
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
