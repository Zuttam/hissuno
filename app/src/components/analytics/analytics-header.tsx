'use client'

import type { ReactNode } from 'react'
import { PeriodSelector } from './period-selector'
import type { AnalyticsPeriod } from '@/lib/supabase/analytics'

interface AnalyticsHeaderProps {
  title: string
  period: AnalyticsPeriod
  onPeriodChange: (period: AnalyticsPeriod) => void
  actions?: ReactNode
}

export function AnalyticsHeader({
  title,
  period,
  onPeriodChange,
  actions,
}: AnalyticsHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="font-mono text-3xl font-bold uppercase tracking-tight text-[color:var(--foreground)]">
        {title}
      </h1>
      <div className="flex items-center gap-4">
        {actions}
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>
    </header>
  )
}
