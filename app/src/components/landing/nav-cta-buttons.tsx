'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { trackInstallCommandCopied, getStoredUTM } from '@/lib/event_tracking'

const SETUP_CMD = 'npm i -g hissuno && hissuno setup'

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  )
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M3.25 3A2.25 2.25 0 001 5.25v9.5A2.25 2.25 0 003.25 17h13.5A2.25 2.25 0 0019 14.75v-9.5A2.25 2.25 0 0016.75 3H3.25zm.943 8.752a.75.75 0 01.055-1.06L6.128 9l-1.88-1.693a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 01-1.06-.055zM9.75 10.25a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z" clipRule="evenodd" />
    </svg>
  )
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06v-11a.75.75 0 00-.546-.721A9.006 9.006 0 0015 3a8.999 8.999 0 00-4.25 1.065v12.755zM9.25 4.065A8.999 8.999 0 005 3c-.85 0-1.673.118-2.454.339A.75.75 0 002 4.06v11a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.065z" />
    </svg>
  )
}

function ExpandableCTA({
  label,
  icon,
  command,
  onCopy,
}: {
  label: string
  icon: React.ReactNode
  command: string
  onCopy?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setExpanded(true)
  }

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setExpanded(false), 150)
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // noop
    }
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div
        className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border)] hover:text-[var(--foreground)] cursor-pointer"
      >
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>

      {/* Expanded command dropdown */}
      <div
        className={`absolute right-0 top-full z-50 mt-1.5 transition-all duration-200 ${
          expanded
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--background)]/95 px-3 py-2 shadow-lg backdrop-blur-sm">
          <span className="font-mono text-xs text-[var(--text-tertiary)]">$</span>
          <code className="font-mono text-xs text-[var(--foreground)]">{command}</code>
          <button
            onClick={handleCopy}
            className="ml-1 flex-shrink-0 rounded p-0.5 text-[var(--text-tertiary)] transition-colors hover:text-[var(--foreground)]"
          >
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export function NavCTAButtons() {
  return (
    <div className="flex items-center gap-2">
      <ExpandableCTA
        label="Get Started"
        icon={<TerminalIcon className="h-3.5 w-3.5" />}
        command={SETUP_CMD}
        onCopy={() => trackInstallCommandCopied({ command_type: 'setup', source: 'nav', utm: getStoredUTM() ?? undefined })}
      />
      <Link
        href="/docs"
        className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border)] hover:text-[var(--foreground)] cursor-pointer"
      >
        <BookIcon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Docs</span>
      </Link>
    </div>
  )
}
