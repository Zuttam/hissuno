import { ComponentPropsWithoutRef } from 'react'

type AlertVariant = 'default' | 'info' | 'success' | 'warning' | 'danger'

type AlertProps = {
  variant?: AlertVariant
  className?: string
} & ComponentPropsWithoutRef<'div'>

const variantClasses: Record<AlertVariant, string> = {
  default:
    'border-[--border-subtle] bg-[--surface] text-[--foreground]',
  info: 'border-[--accent-primary] bg-transparent text-[--foreground]',
  success:
    'border-[--accent-success] bg-transparent text-[--foreground]',
  warning:
    'border-[--accent-warning] bg-transparent text-[--foreground]',
  danger:
    'border-[--accent-danger] bg-transparent text-[--foreground]',
}

export function Alert({ variant = 'default', className, ...props }: AlertProps) {
  const baseClasses = 'rounded-[4px] border-2 px-4 py-3 text-sm font-mono'
  const mergedClasses = [baseClasses, variantClasses[variant], className ?? '']
    .filter(Boolean)
    .join(' ')

  return <div {...props} className={mergedClasses} />
}

