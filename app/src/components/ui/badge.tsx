import { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils/class'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  variant?: BadgeVariant
  /** Use filled background (same as card background) instead of transparent */
  filled?: boolean
}

const variantClasses: Record<BadgeVariant, { transparent: string; filled: string }> = {
  default: {
    transparent: 'border-[color:var(--border-subtle)] bg-transparent text-[color:var(--text-secondary)]',
    filled: 'border-[color:var(--border-subtle)] bg-[color:var(--background)] text-[color:var(--text-secondary)]',
  },
  success: {
    transparent: 'border-[color:var(--accent-success)] bg-transparent text-[color:var(--accent-success)]',
    filled: 'border-[color:var(--accent-success)] bg-[color:var(--background)] text-[color:var(--accent-success)]',
  },
  warning: {
    transparent: 'border-[color:var(--accent-warning)] bg-transparent text-[color:var(--accent-warning)]',
    filled: 'border-[color:var(--accent-warning)] bg-[color:var(--background)] text-[color:var(--accent-warning)]',
  },
  danger: {
    transparent: 'border-[color:var(--accent-danger)] bg-transparent text-[color:var(--accent-danger)]',
    filled: 'border-[color:var(--accent-danger)] bg-[color:var(--background)] text-[color:var(--accent-danger)]',
  },
  info: {
    transparent: 'border-[color:var(--accent-info)] bg-transparent text-[color:var(--accent-info)]',
    filled: 'border-[color:var(--accent-info)] bg-[color:var(--background)] text-[color:var(--accent-info)]',
  },
}

export function Badge({ variant = 'default', filled = false, className, children, ...props }: BadgeProps) {
  const variantStyle = variantClasses[variant] ?? variantClasses.default

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] border-2 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider',
        filled ? variantStyle.filled : variantStyle.transparent,
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

// Helper function to map status to badge variant
export function getStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'running':
      return 'warning'
    case 'failed':
      return 'danger'
    default:
      return 'default'
  }
}

// Helper function to format status label
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'running':
      return 'Running'
    case 'failed':
      return 'Failed'
    case 'pending':
      return 'Pending'
    default:
      return status
  }
}

