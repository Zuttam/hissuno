'use client'

import { useState } from 'react'
import { trackInstallCommandCopied, getStoredUTM } from '@/lib/event_tracking'

const TABS = [
  { key: 'setup', label: 'New project', command: 'npm i -g hissuno && hissuno setup' },
  { key: 'config', label: 'Join existing', command: 'npm i -g hissuno && hissuno config' },
] as const

type TabKey = (typeof TABS)[number]['key']

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

interface InstallCommandProps {
  size?: 'sm' | 'lg'
}

export function InstallCommand({ size = 'lg' }: InstallCommandProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('setup')
  const [copied, setCopied] = useState(false)

  const active = TABS.find((t) => t.key === activeTab)!

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(active.command)
      setCopied(true)
      trackInstallCommandCopied({ command_type: activeTab, source: 'hero', utm: getStoredUTM() ?? undefined })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: do nothing
    }
  }

  const isLg = size === 'lg'

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Tabs */}
      <div className="flex gap-1 rounded-md bg-[var(--surface)]/60 p-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setCopied(false) }}
            className={`rounded-md px-3 py-1 font-mono transition-all ${
              isLg ? 'text-xs' : 'text-[11px]'
            } ${
              activeTab === tab.key
                ? 'bg-[var(--surface-hover)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Command */}
      <button
        onClick={handleCopy}
        className={`group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm transition-all hover:border-[var(--accent-teal)]/50 hover:bg-[var(--surface-hover)] ${
          isLg ? 'px-5 py-3' : 'px-4 py-2.5'
        }`}
      >
        <span className={`font-mono text-[var(--text-tertiary)] ${isLg ? 'text-sm' : 'text-xs'}`}>$</span>
        <code className={`font-mono text-[var(--foreground)] ${isLg ? 'text-sm' : 'text-xs'}`}>
          {active.command}
        </code>
        <span className="ml-auto flex-shrink-0 rounded p-1 text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--foreground)]">
          {copied ? (
            <CheckIcon className={`text-emerald-500 ${isLg ? 'h-4 w-4' : 'h-3.5 w-3.5'}`} />
          ) : (
            <CopyIcon className={isLg ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
          )}
        </span>
      </button>
    </div>
  )
}
