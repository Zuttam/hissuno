'use client'

import type { AnalyticsPeriod } from '@/lib/db/queries/analytics'

interface PeriodSelectorProps {
  value: AnalyticsPeriod
  onChange: (period: AnalyticsPeriod) => void
  className?: string
}

const PERIODS: { value: AnalyticsPeriod; label: string; shortLabel: string }[] = [
  { value: '7d', label: '7 days', shortLabel: '7d' },
  { value: '30d', label: '30 days', shortLabel: '30d' },
  { value: '90d', label: '90 days', shortLabel: '90d' },
  { value: 'all', label: 'All time', shortLabel: 'All' },
]

export function PeriodSelector({ value, onChange, className = '' }: PeriodSelectorProps) {
  return (
    <div
      className={`inline-flex rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-1 ${className}`}
    >
      {PERIODS.map((period) => (
        <button
          key={period.value}
          type="button"
          onClick={() => onChange(period.value)}
          className={`px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-mono uppercase transition-colors rounded-[2px] ${
            value === period.value
              ? 'bg-[color:var(--accent-primary)] text-white'
              : 'text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--background)]'
          }`}
        >
          <span className="sm:hidden">{period.shortLabel}</span>
          <span className="hidden sm:inline">{period.label}</span>
        </button>
      ))}
    </div>
  )
}
