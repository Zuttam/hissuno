import { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Info, Check, TriangleAlert, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/class'

type InlineAlertVariant = 'info' | 'success' | 'danger' | 'attention'

const config: Record<InlineAlertVariant, { icon: ReactNode; className: string }> = {
  info: {
    icon: <Info size={13} />,
    className: 'text-[color:var(--accent-info)]',
  },
  success: {
    icon: <Check size={13} />,
    className: 'text-[color:var(--accent-success)]',
  },
  danger: {
    icon: <AlertCircle size={13} />,
    className: 'text-[color:var(--accent-danger)]',
  },
  attention: {
    icon: <TriangleAlert size={13} />,
    className: 'text-[color:var(--accent-warning)]',
  },
}

type InlineAlertProps = {
  variant: InlineAlertVariant
  className?: string
} & ComponentPropsWithoutRef<'p'>

export function InlineAlert({ variant, className, children, ...props }: InlineAlertProps) {
  const { icon, className: variantClass } = config[variant]
  return (
    <p {...props} className={cn('flex items-start gap-2 text-xs text-[color:var(--text-tertiary)]', className)}>
      <span className={cn('mt-px shrink-0', variantClass)}>{icon}</span>
      <span>{children}</span>
    </p>
  )
}
