import { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils/class'

type AlertVariant = 'default' | 'info' | 'success' | 'warning' | 'danger'

type AlertProps = {
  variant?: AlertVariant
  className?: string
} & ComponentPropsWithoutRef<'div'>

const variantClasses: Record<AlertVariant, string> = {
  default:
    'border-2 border-[--border-subtle] bg-[--surface] text-[--foreground]',
  info: 'border-2 border-[--accent-info] bg-transparent text-[--foreground]',
  success:
    'border-2 border-[--accent-success] bg-transparent text-[--foreground]',
  warning:
    'border-2 border-[--accent-warning] bg-transparent text-[--foreground]',
  danger:
    'border-2 border-[--accent-danger] bg-transparent text-[--foreground]',
}

export function Alert({ variant = 'default', className, ...props }: AlertProps) {
  return <div {...props} className={cn('rounded-[4px] px-4 py-3 text-sm font-mono', variantClasses[variant], className)} />
}

