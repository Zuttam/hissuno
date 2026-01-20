'use client'

import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  change?: number
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function StatCard({
  label,
  value,
  change,
  icon,
  trend,
  size = 'md',
  className = '',
}: StatCardProps) {
  const effectiveTrend = trend ?? (change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : undefined)

  const valueSize = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  }[size]

  const labelSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size]

  const padding = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }[size]

  return (
    <div
      className={`rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] ${padding} ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={`font-mono uppercase text-[color:var(--text-secondary)] ${labelSize}`}>
            {label}
          </p>
          <p className={`font-mono font-bold text-[color:var(--foreground)] ${valueSize}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        {icon && (
          <div className="text-[color:var(--text-secondary)]">
            {icon}
          </div>
        )}
      </div>

      {change !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          {effectiveTrend === 'up' && (
            <svg
              className="h-4 w-4 text-[color:var(--accent-success)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
          {effectiveTrend === 'down' && (
            <svg
              className="h-4 w-4 text-[color:var(--accent-danger)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          <span
            className={`text-xs font-mono ${
              effectiveTrend === 'up'
                ? 'text-[color:var(--accent-success)]'
                : effectiveTrend === 'down'
                  ? 'text-[color:var(--accent-danger)]'
                  : 'text-[color:var(--text-secondary)]'
            }`}
          >
            {change > 0 ? '+' : ''}
            {change}% vs previous
          </span>
        </div>
      )}
    </div>
  )
}

interface StatCardGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function StatCardGrid({ children, columns = 4, className = '' }: StatCardGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns]

  return <div className={`grid gap-4 ${gridCols} ${className}`}>{children}</div>
}
