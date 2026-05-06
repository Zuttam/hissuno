'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'

interface SettingRowProps {
  icon: string
  title: string
  description: string
  rightMeta?: ReactNode
  onClick: () => void
  disabled?: boolean
}

export function SettingRow({
  icon,
  title,
  description,
  rightMeta,
  onClick,
  disabled = false,
}: SettingRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[color:var(--surface-hover)] ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <span className="text-xl shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[color:var(--foreground)]">{title}</div>
        <div className="truncate text-xs text-[color:var(--text-secondary)]">{description}</div>
      </div>
      {rightMeta && <div className="flex items-center gap-2 shrink-0">{rightMeta}</div>}
      <svg
        className="h-4 w-4 shrink-0 text-[color:var(--text-tertiary)] transition-colors group-hover:text-[color:var(--foreground)]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  )
}

interface ChannelMeta {
  id: string
  logo: string | null
  label: string
  active: boolean
  comingSoon?: boolean
}

export function ChannelsMeta({ channels }: { channels: ChannelMeta[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {channels.map((ch) => {
        const opacity = ch.active ? 'opacity-100' : 'opacity-30'
        const title = ch.comingSoon
          ? `${ch.label} (coming soon)`
          : ch.active
            ? `${ch.label} (connected)`
            : `${ch.label} (not connected)`
        if (!ch.logo) {
          return (
            <span key={ch.id} className={`${opacity} flex items-center justify-center`} title={title}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </span>
          )
        }
        return (
          <span key={ch.id} className={opacity} title={title}>
            <Image src={ch.logo} alt={ch.label} width={16} height={16} />
          </span>
        )
      })}
    </div>
  )
}

export function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`text-[10px] font-medium uppercase tracking-wider ${
        enabled
          ? 'text-[color:var(--accent-success)]'
          : 'text-[color:var(--text-tertiary)]'
      }`}
    >
      {enabled ? 'On' : 'Off'}
    </span>
  )
}
