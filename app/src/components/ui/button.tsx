import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/class'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  selected?: boolean
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-1 border-(--accent-primary) bg-(--accent-primary) text-white hover:bg-[var(--accent-primary-hover)] hover:border-[var(--accent-primary-hover)]',
  secondary:
    'border-1 border-(--border) bg-transparent text-(--foreground) hover:bg-(--surface-hover)]',
  ghost:
    'border-1 border-(--border-subtle) bg-(--surface) text-(--foreground) hover:border-(--border) hover:bg-(--surface-hover)]',
  danger:
    'border-1 border-(--accent-danger) bg-transparent text-(--accent-danger) hover:bg-(--accent-danger) hover:text-white',
}

const selectedClasses: Record<ButtonVariant, string> = {
  primary:
    '!bg-(--accent-selected) !border-(--accent-selected) !text-white shadow-[0_0_0_4px_rgba(37,99,235,0.4)] dark:shadow-[0_0_0_4px_rgba(59,130,246,0.4)]',
  secondary:
    '!bg-(--accent-selected) !border-(--accent-selected) !text-white shadow-[0_0_0_4px_rgba(37,99,235,0.3)] dark:shadow-[0_0_0_4px_rgba(59,130,246,0.3)]',
  ghost:
    '!bg-(--accent-selected) !border-(--accent-selected) !text-white shadow-[0_0_0_4px_rgba(37,99,235,0.35)] dark:shadow-[0_0_0_4px_rgba(59,130,246,0.35)]',
  danger:
    '!bg-(--accent-danger) !border-(--accent-danger) !text-white shadow-[0_0_0_4px_rgba(239,68,68,0.4)] dark:shadow-[0_0_0_4px_rgba(255,85,85,0.4)]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-sm',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, selected = false, disabled, children, ...props }, ref) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-pressed={selected}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-[4px] font-mono font-semibold uppercase tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          selected && selectedClasses[variant],
          className
        )}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }

