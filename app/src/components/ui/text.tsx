import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/class'

type TextSize = 'lg' | 'base' | 'sm' | 'xs'
type TextVariant = 'default' | 'muted' | 'error' | 'success'

const sizeClasses: Record<TextSize, string> = {
  lg: 'text-lg',
  base: 'text-base',
  sm: 'text-sm',
  xs: 'text-xs',
}

const variantClasses: Record<TextVariant, string> = {
  default: 'text-[color:var(--foreground)]',
  muted: 'text-[color:var(--foreground-muted)]',
  error: 'text-red-500',
  success: 'text-green-500',
}

interface TextProps {
  as?: 'p' | 'span' | 'div' | 'label'
  size?: TextSize
  variant?: TextVariant
  mono?: boolean
  className?: string
  children?: ReactNode
}

function Text({
  as: Tag = 'p',
  size = 'base',
  variant = 'default',
  mono = false,
  className,
  children,
}: TextProps) {
  return (
    <Tag className={cn(sizeClasses[size], variantClasses[variant], mono && 'font-mono', className)}>
      {children}
    </Tag>
  )
}

export { Text, type TextProps, type TextSize, type TextVariant }
