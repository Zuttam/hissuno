import { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils/class'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'border-[color:var(--border)] bg-transparent text-[color:var(--text-secondary)]',
  success: 'border-[color:var(--accent-success)] bg-transparent text-[color:var(--accent-success)]',
  warning: 'border-[color:var(--accent-warning)] bg-transparent text-[color:var(--accent-warning)]',
  danger: 'border-[color:var(--accent-danger)] bg-transparent text-[color:var(--accent-danger)]',
  info: 'border-[color:var(--accent-primary)] bg-transparent text-[color:var(--accent-primary)]',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] border-2 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider',
        variantClasses[variant],
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

