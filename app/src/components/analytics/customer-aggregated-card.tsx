'use client'

import { Spinner } from '@/components/ui/spinner'
import type { CustomersStripAnalytics } from '@/types/customer'

interface CustomerAggregatedCardProps {
  data: CustomersStripAnalytics | null
  isLoading: boolean
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

export function CustomerAggregatedCard({ data, isLoading }: CustomerAggregatedCardProps) {
  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
      <p className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">
        Customers
      </p>
      {isLoading ? (
        <div className="flex h-[40px] items-center">
          <Spinner size="sm" />
        </div>
      ) : data ? (
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
          <Metric label="Companies" value={data.totalCompanies} />
          <Metric label="Contacts" value={data.totalContacts} />
          <Metric label="Champions" value={data.champions} />
          <Metric label="ARR" value={formatCurrency(data.totalARR)} />
        </div>
      ) : (
        <p className="mt-1 font-mono text-xl font-bold text-[color:var(--foreground)]">-</p>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="font-mono text-sm font-bold text-[color:var(--foreground)]">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="font-mono text-[9px] uppercase text-[color:var(--text-tertiary)]">
        {label}
      </span>
    </div>
  )
}
