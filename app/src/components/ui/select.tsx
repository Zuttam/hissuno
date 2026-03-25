import { forwardRef, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/class'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => {
    return (
      <div className={cn('relative', wrapperClassName)}>
        <select
          className={cn(
            'w-full appearance-none rounded-md border border-[--border-subtle] bg-[--background] pl-2.5 pr-8 py-1.5 text-sm text-[--foreground] outline-none transition focus:border-[--accent-primary] focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }

