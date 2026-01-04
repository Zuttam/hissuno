import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/class'

type IconButtonVariant = 'ghost' | 'outline' | 'subtle'
type IconButtonSize = 'sm' | 'md' | 'lg'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: IconButtonSize
  loading?: boolean
  'aria-label': string
  children: ReactNode
}

const variantClasses: Record<IconButtonVariant, string> = {
  ghost:
    'bg-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]',
  outline:
    'border border-[color:var(--border-subtle)] bg-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]',
  subtle:
    'bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]',
}

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
}

const iconSizeClasses: Record<IconButtonSize, string> = {
  sm: '[&>svg]:h-3.5 [&>svg]:w-3.5',
  md: '[&>svg]:h-4 [&>svg]:w-4',
  lg: '[&>svg]:h-5 [&>svg]:w-5',
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', loading = false, disabled, children, ...props }, ref) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center rounded-[4px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          iconSizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          children
        )}
      </button>
    )
  }
)
IconButton.displayName = 'IconButton'

export { IconButton }
