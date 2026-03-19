import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/class'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'w-full rounded-[4px] border-2 border-[--border-subtle] bg-[--background] px-3 py-2 text-sm font-mono text-[--foreground] outline-none transition focus:border-[--accent-primary] focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }

