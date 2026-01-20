import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/class'

type DropdownButtonSize = 'sm' | 'md'

export interface DropdownButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  open?: boolean
  active?: boolean
  size?: DropdownButtonSize
  children: ReactNode
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const sizeClasses: Record<DropdownButtonSize, string> = {
  sm: 'px-2 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
}

const DropdownButton = forwardRef<HTMLButtonElement, DropdownButtonProps>(
  ({ className, open = false, active = false, size = 'md', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          'flex items-center gap-1.5 font-mono font-semibold uppercase tracking-wide transition',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          sizeClasses[size],
          active
            ? 'bg-[--foreground] text-[--background]'
            : 'bg-transparent text-[--text-secondary] hover:bg-[--surface-hover]',
          className
        )}
        {...props}
      >
        <span>{children}</span>
        <ChevronDownIcon className={cn('transition-transform', open && 'rotate-180')} />
      </button>
    )
  }
)
DropdownButton.displayName = 'DropdownButton'

export { DropdownButton }
